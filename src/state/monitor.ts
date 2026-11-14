// Live press monitor: the HITS feature's undocumented monitoring streams, read while the user has it on.
// Event 0 (flag bit 0) and events 1, 2 and 3 (flag bit 1) arrive as HID++ notifications at about 60 Hz.
// The flags are only leased for a few seconds and renewed while the monitor runs; stopping restores
// the flags that were set before. Observed on a PRO X3 (all values are big-endian uint16 words):
//   event 1: words 0 and 1 = left and right button travel (raw sensor reading, rest ≈ 280–300)
//   event 2: words 0 and 1 = each button's top level (fully released), tracked by the firmware
//   event 3: words 0 and 1 = each button's bottom level (fully pressed, the click point at actuation 10);
//            always event 2 plus a fixed amount per button (≈209 left, ≈179 right on the tested mouse)
import { useEffect, useSyncExternalStore } from "react";
import { F } from "../hid/device";
import { HidppError } from "../hid/transport";
import { getMouseInput } from "../components/useMouseInput";
import { getState, run, useStore } from "./store";

export interface Stream {
  count: number;
  rate: number; // messages in the last second
  raw: string; // last payload as hex
  words: number[]; // last payload as 8 big-endian uint16
}

export interface Monitor {
  state: "off" | "starting" | "on";
  error: string;
  streams: Record<number, Stream>;
  maxTravel: [number, number]; // deepest travel seen per button, for the bar's full scale
}

/** One travel report, with the latest top / bottom levels and whether the browser saw the button down. */
export interface Sample {
  t: number; // performance.now()
  travel: [number, number];
  top: [number, number];
  bottom: [number, number];
  down: [boolean, boolean];
}
export const HISTORY_MS = 6000;
let history: Sample[] = [];
/** The last HISTORY_MS of samples, oldest first (read it when the monitor store changes). */
export const getHistory = (): readonly Sample[] => history;

const FLAGS = 0x03; // both groups
const LEASE_S = 8;
const RENEW_MS = 2000;

let mon: Monitor = { state: "off", error: "", streams: {}, maxTravel: [0, 0] };
const listeners = new Set<() => void>();
const set = (patch: Partial<Monitor>) => {
  mon = { ...mon, ...patch };
  listeners.forEach((l) => l());
};
export const getMonitor = () => mon;
export const useMonitor = <T,>(select: (m: Monitor) => T): T =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => select(mon));

let stop: (() => Promise<void>) | null = null;
const hex = (b: Uint8Array) => Array.from(b, (c) => c.toString(16).padStart(2, "0")).join(" ");

export async function startMonitor() {
  if (mon.state !== "off" || getState().status !== "connected") return;
  history = [];
  set({ state: "starting", error: "", streams: {}, maxTravel: [0, 0] });
  const started = await run(async (d) => {
    const idx = await d.feature(F.HITS);
    const { flags: before } = await d.monitorGet();
    const hid = d.t.dev;
    const streams: Record<number, Stream & { times: number[] }> = {};
    const maxTravel: [number, number] = [0, 0];
    let frame = 0;
    const onReport = (e: HIDInputReportEvent) => {
      if (e.reportId !== 0x11) return;
      const r = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      if (r.length < 19 || r[0] !== d.index || r[1] !== idx || (r[2] & 0x0f) !== 0) return; // notifications have software id 0
      const fn = r[2] >> 4;
      const now = performance.now();
      const s = (streams[fn] ??= { count: 0, rate: 0, raw: "", words: [], times: [] });
      s.count++;
      s.times.push(now);
      while (now - s.times[0] > 1000) s.times.shift();
      s.rate = s.times.length;
      s.raw = hex(r.subarray(3, 19));
      s.words = Array.from({ length: 8 }, (_, i) => (r[3 + 2 * i] << 8) | r[4 + 2 * i]);
      if (fn === 1) {
        for (const b of [0, 1]) maxTravel[b] = Math.max(maxTravel[b], s.words[b]);
        const top = streams[2]?.words, bottom = streams[3]?.words, pressed = getMouseInput().pressed;
        if (top && bottom) history.push({
          t: now, travel: [s.words[0], s.words[1]], top: [top[0], top[1]], bottom: [bottom[0], bottom[1]],
          down: [pressed.has("btn-left"), pressed.has("btn-right")],
        });
        let old = 0;
        while (old < history.length && now - history[old].t > HISTORY_MS) old++;
        if (old) history = history.slice(old);
      }
      // one screen update per frame, however many reports came in
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        set({ streams: { ...streams }, maxTravel: [...maxTravel] });
      });
    };
    hid.addEventListener("inputreport", onReport);
    await d.monitorSet(FLAGS, LEASE_S);
    const timer = setInterval(async () => {
      try {
        await d.monitorSet(FLAGS, LEASE_S);
      } catch (e) {
        if (e instanceof HidppError && e.timeout) return; // a missed renewal: the lease lasts long enough for the next one
        void stopMonitor(e instanceof Error ? e.message : String(e));
      }
    }, RENEW_MS);
    stop = async () => {
      clearInterval(timer);
      hid.removeEventListener("inputreport", onReport);
      cancelAnimationFrame(frame);
      if (getState().status === "connected") await d.monitorSet(before, LEASE_S).catch(() => undefined);
    };
    return true;
  });
  set(started ? { state: "on" } : { state: "off", error: "Could not start the live press monitor" });
}

export async function stopMonitor(error = "") {
  const s = stop;
  stop = null;
  set({ state: "off", error });
  await s?.();
}

// The live view runs while a panel showing it is open (Click: the bars, Device: the charts) and stops when the
// last one closes.
let users = 0;

/** Runs the monitor while the calling component is shown. */
export function useLiveMonitor() {
  const ready = useStore((s) => s.status === "connected" && !s.info?.demo);
  useEffect(() => {
    users++;
    return () => {
      if (--users === 0) void stopMonitor();
    };
  }, []);
  useEffect(() => {
    void (ready ? startMonitor() : stopMonitor()); // the mouse went away: start again once it is back
  }, [ready]);
}
