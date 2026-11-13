// HID++ 2.0 framing over WebHID. Every request is a long report (0x11, 19 bytes after the id);
// replies are matched on device index, feature index and function/software id.

export class HidppError extends Error {
  constructor(message: string, readonly code = 0, readonly timeout = false) {
    super(message);
  }
}

export type Bytes = Uint8Array;

const SHORT_REPORT = 0x10;
const LONG_REPORT = 0x11;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Transport {
  readonly swid = 2 + Math.floor(Math.random() * 14); // 2..15, so two apps on one receiver do not mix replies
  private queue: Promise<unknown> = Promise.resolve();
  onTraffic?: (dir: "out" | "in", bytes: Bytes) => void;

  constructor(readonly dev: HIDDevice) {}

  /** Runs requests one at a time: HID++ replies only make sense in order. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Sends one request and resolves with the 16 reply parameter bytes. */
  request(devIdx: number, feat: number, func: number, params: ArrayLike<number> = [], timeoutMs = 1000): Promise<Bytes> {
    return this.serial(() => this.send(devIdx, feat, func, params, timeoutMs));
  }

  private send(devIdx: number, feat: number, func: number, params: ArrayLike<number>, timeoutMs: number): Promise<Bytes> {
    const fs = ((func << 4) | this.swid) & 0xff;
    const out = new Uint8Array(19);
    out[0] = devIdx;
    out[1] = feat;
    out[2] = fs;
    out.set(Array.from(params).slice(0, 16), 3);
    const tag = `feat=0x${feat.toString(16)} func=${func}`;

    return new Promise((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        this.dev.removeEventListener("inputreport", onReport);
      };
      const timer = setTimeout(() => {
        done();
        reject(new HidppError(`timeout ${tag}`, 0, true));
      }, timeoutMs);
      const onReport = (e: HIDInputReportEvent) => {
        if (e.reportId !== SHORT_REPORT && e.reportId !== LONG_REPORT) return;
        const r = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
        if (r.length < 3 || r[0] !== devIdx) return;
        if (r.length >= 5 && r[1] === 0xff && r[2] === feat && r[3] === fs) {
          done();
          this.onTraffic?.("in", r);
          reject(new HidppError(`HID++ 2.0 error ${r[4]} ${tag}`, r[4]));
        } else if (r.length >= 5 && r[1] === 0x8f && r[2] === feat) {
          done();
          this.onTraffic?.("in", r);
          reject(new HidppError(`HID++ 1.0 error ${r[4]} ${tag}`, r[4]));
        } else if (r[1] === feat && r[2] === fs) {
          done();
          this.onTraffic?.("in", r);
          const body = new Uint8Array(16);
          body.set(r.subarray(3, 19));
          resolve(body);
        }
      };
      this.dev.addEventListener("inputreport", onReport);
      this.onTraffic?.("out", out);
      this.dev.sendReport(LONG_REPORT, out).catch((err: unknown) => {
        done();
        reject(new HidppError(`write failed: ${err instanceof Error ? err.message : String(err)}`));
      });
    });
  }
}
