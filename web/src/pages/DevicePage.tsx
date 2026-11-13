// Device: information, look, HID++ feature table, raw traffic, about.
import { Panel, Row } from "../components/controls";
import { disconnect, setLook, useStore } from "../state/store";

const FEATURE_NAMES: Record<number, string> = {
  0x0000: "Root", 0x0001: "Feature set", 0x0003: "Firmware info", 0x0005: "Device name", 0x1004: "Battery",
  0x1b0c: "HITS (SUPERSTRIKE tuning)", 0x2202: "Extended DPI", 0x8061: "Report rate", 0x8090: "Mode status",
  0x80e0: "Scroll filter", 0x8100: "Onboard profiles",
};
const hex4 = (n: number) => "0x" + n.toString(16).padStart(4, "0").toUpperCase();

export default function DevicePage() {
  const info = useStore((s) => s.info);
  const shell = useStore((s) => s.shell);
  const accent = useStore((s) => s.accent);
  const log = useStore((s) => s.log);
  if (!info) return <p className="hint">Not connected.</p>;
  const o = info.onboard;

  return (
    <div className="page cols">
      <div className="col">
        <Panel title="DEVICE">
          <Row title="Name"><span>{info.name}</span></Row>
          <Row title="Connection">
            <span>{info.index === 0xff ? "USB cable" : `LIGHTSPEED receiver slot ${info.index}`} · 046d:{info.productId.toString(16).padStart(4, "0")}</span>
          </Row>
          <Row title="Battery"><span>{info.battery < 0 ? "unknown" : `${info.battery} % · ${info.batteryState}`}</span></Row>
          <Row title="Firmware"><span className="multiline">{info.firmware.join("\n")}</span></Row>
          {o && (
            <Row title="Onboard memory">
              <span>format {o.format} · {o.profiles} profiles · {o.buttons} buttons · {o.sectors} sectors of {o.sectorSize} bytes</span>
            </Row>
          )}
          <button onClick={() => void disconnect()}>Disconnect</button>
        </Panel>
        <Panel title="LOOK">
          <Row title="Mouse colour in the pictures">
            <input type="color" value={shell} onChange={(e) => setLook(e.target.value, accent)} aria-label="Mouse colour" />
          </Row>
          <Row title="Accent colour">
            <input type="color" value={accent} onChange={(e) => setLook(shell, e.target.value)} aria-label="Accent colour" />
          </Row>
        </Panel>
        <Panel title="ABOUT">
          <p>
            SuperStrike Studio Web is a browser port of{" "}
            <a href="https://github.com/Adhamura/superstrike-studio" target="_blank" rel="noreferrer">SuperStrike Studio</a> (MIT licence), using WebHID.
            Nothing is sent anywhere: the page talks only to the mouse, and settings stay in this browser.
          </p>
          <p className="hint">Not affiliated with or endorsed by Logitech.</p>
        </Panel>
      </div>
      <div className="col">
        <Panel title="HID++ FEATURES">
          <div className="features">
            {info.features.map((f) => (
              <div key={f.index}>
                <code>{hex4(f.id)}</code> {FEATURE_NAMES[f.id] ?? ""}
                <small> index {f.index} · v{f.version} · flags 0x{f.flags.toString(16)}</small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="HID TRAFFIC">
          <pre className="log">{log.slice(-120).join("\n")}</pre>
        </Panel>
      </div>
    </div>
  );
}
