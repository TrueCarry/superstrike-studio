// Device: information, language, look, HID++ feature table, raw traffic, about.
import { Panel, Row } from "../components/controls";
import { batteryStateText } from "../hid/device";
import { f, LANGUAGES, setLanguage, t, tc, tn, useLanguage } from "../i18n/i18n";
import { disconnect, setLook, useStore } from "../state/store";

const FEATURE_NAMES: Record<number, string> = {
  0x0000: "Root", 0x0001: "Feature set", 0x0003: "Firmware info", 0x0005: "Device name", 0x1004: "Battery",
  0x1b0c: "HITS (SUPERSTRIKE tuning)", 0x2202: "Extended DPI", 0x8061: "Report rate", 0x8090: "Mode status",
  0x80e0: "Scroll filter", 0x8100: "Onboard profiles",
};
const hex4 = (n: number) => "0x" + n.toString(16).padStart(4, "0").toUpperCase();

export function LanguagePicker() {
  const { choice } = useLanguage();
  return (
    <select value={choice} onChange={(e) => void setLanguage(e.target.value)} aria-label={t("Language")}>
      <option value="system">{t("System default")}</option>
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} lang={l.code.replace("_", "-")}>{l.native}</option>
      ))}
    </select>
  );
}

export default function DevicePage() {
  const info = useStore((s) => s.info);
  const shell = useStore((s) => s.shell);
  const accent = useStore((s) => s.accent);
  const log = useStore((s) => s.log);
  if (!info) return null;
  const o = info.onboard;

  return (
    <div className="page cols">
      <div className="col">
        <Panel title={tc("page", "Device").toUpperCase()}>
          <Row title={tc("device info", "Name")}><span>{info.name}</span></Row>
          <Row title={t("Connection")}>
            <span>{info.index === 0xff ? t("USB cable") : f(t("LIGHTSPEED receiver slot %d"), info.index)} · 046d:{info.productId.toString(16).padStart(4, "0")}</span>
          </Row>
          <Row title={t("Battery")}>
            <span>{info.battery < 0 ? "—" : f(t("%d %% · %s"), info.battery, batteryStateText(info.batteryState))}</span>
          </Row>
          <Row title={t("Firmware")}><span className="multiline">{info.firmware.join("\n")}</span></Row>
          {o && (
            <Row title={t("Onboard memory")}>
              <span>
                {f(t("format %d"), o.format)} · {f(tn("%d profile", "%d profiles", o.profiles), o.profiles)} ·{" "}
                {f(tn("%d sector × %d bytes", "%d sectors × %d bytes", o.sectors), o.sectors, o.sectorSize)}
              </span>
            </Row>
          )}
          <button onClick={() => void disconnect()}>Disconnect</button>
        </Panel>
        <Panel title={t("LOOK")}>
          <Row title={t("Language")}><LanguagePicker /></Row>
          <Row title={t("Mouse colour in the pictures")}>
            <input type="color" value={shell} onChange={(e) => setLook(e.target.value, accent)} aria-label={t("Mouse colour in the pictures")} />
          </Row>
          <Row title="Accent colour">
            <input type="color" value={accent} onChange={(e) => setLook(shell, e.target.value)} aria-label="Accent colour" />
          </Row>
        </Panel>
        <Panel title={f(t("About %s"), "SuperStrike Studio Web").toUpperCase()}>
          <p>
            SuperStrike Studio Web is a browser port of{" "}
            <a href="https://github.com/Adhamura/superstrike-studio" target="_blank" rel="noreferrer">SuperStrike Studio</a> (MIT licence), using WebHID.
            Nothing is sent anywhere: the page talks only to the mouse, and settings stay in this browser.
          </p>
          <p className="hint">{t("Not affiliated with or endorsed by Logitech.")}</p>
        </Panel>
      </div>
      <div className="col">
        <Panel title={t("HID++ FEATURES")} extra={<small>{f(tn("%d feature", "%d features", info.features.length), info.features.length)}</small>}>
          <div className="features">
            {info.features.map((ft) => (
              <div key={ft.index}>
                <code>{hex4(ft.id)}</code> {FEATURE_NAMES[ft.id] ?? ""}
                <small> {f(t("index %d · v%d · flags 0x%s"), ft.index, ft.version, ft.flags.toString(16))}</small>
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
