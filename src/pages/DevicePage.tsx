// Device panel (upstream page_device.cpp): the mouse and its firmware, backup and restore, look and
// language, HID++ features, About. Web-only extras sit in a collapsed Advanced fold.
// Not ported: "Check for updates" (the web page is always the latest version).
import { Boxed, ButtonRow, ComboRow, ExpanderRow, Row } from "../components/controls";
import { ask } from "../components/dialogs";
import { Icon } from "../components/icons";
import { batteryStateText } from "../hid/device";
import { f, LANGUAGES, setLanguage, t, tc, tn, useLanguage } from "../i18n/i18n";
import { disconnect, setLook, useStore } from "../state/store";
import { BackupPanel } from "./ProfilesPage";

const hex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, "0");
const VERSION = "0.1.0";
const APP_NAME = "SuperStrike Studio Plus";

/** Language picker: "System default" first, then every language by its own name (never translated). */
export function LanguagePicker() {
  const { choice } = useLanguage();
  return (
    <span className="combo">
      <select value={choice} onChange={(e) => void setLanguage(e.target.value)} aria-label={t("Language")}>
        <option value="system">{t("System default")}</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code.replace("_", "-")}>{l.native}</option>
        ))}
      </select>
      <Icon name="down" />
    </span>
  );
}

function showAbout() {
  void ask({
    className: "about",
    heading: APP_NAME,
    body: `${VERSION}\nTrueCarry, thekiba\n\n${t("Not affiliated with or endorsed by Logitech.")}\n\nWeb port of SuperStrike Studio by Adhamura, using WebHID: the page talks only to the mouse, settings stay in this browser.\n© 2026 TrueCarry and thekiba · MIT`,
    extra: <img src="./logo.svg" alt="" />,
    responses: [
      { id: "web", label: "Website" },
      { id: "close", label: t("Close"), look: "suggested" },
    ],
    default: "close",
  }).then((r) => r === "web" && window.open("https://github.com/TrueCarry/superstrike-studio", "_blank", "noopener"));
}

export default function DevicePage() {
  const info = useStore((s) => s.info);
  const connected = useStore((s) => s.status === "connected");
  const shell = useStore((s) => s.shell);
  const accent = useStore((s) => s.accent);
  const log = useStore((s) => s.log);
  const { choice } = useLanguage();
  const on = connected && !!info;
  const o = info?.onboard;
  const battery = !on || info.battery < 0 ? "" : info.batteryState ? f(t("%d %% · %s"), info.battery, batteryStateText(info.batteryState)) : f(t("%d %%"), info.battery);
  const memory = on && o
    ? `${f(tn("%d profile", "%d profiles", o.profiles), o.profiles)} · ${f(t("format %d"), o.format)} · ${f(tn("%d sector × %d bytes", "%d sectors × %d bytes", o.sectors), o.sectors, o.sectorSize)}`
    : "";
  const prop = (title: string, value: string) => <Row property title={title} subtitle={value || "—"} />;

  return (
    <>
      <div className="panel-head"><h2>{tc("page", "Device")}</h2></div>

      <section className="device-hero">
        <img src="./logo.svg" alt="" />
        <div>
          <h3>{on ? info.name : "PRO X3 SUPERSTRIKE"}</h3>
          <span className="ss-hint">{t("Connected")}</span>
        </div>
      </section>

      <Boxed>
        {prop(t("Battery"), battery)}
        {prop(t("Connection"), on ? `${info.demo ? "demo" : "WebHID"} 046d:${info.productId.toString(16).padStart(4, "0")} · ${info.index === 0xff ? t("USB cable") : f(t("LIGHTSPEED receiver slot %d"), info.index)}` : "")}
        {prop(t("Firmware"), on ? info.firmware.join("\n") : "")}
        {prop(t("Onboard memory"), memory)}
      </Boxed>

      <BackupPanel />

      <section className="ss-panel">
        <h2 className="ss-title">{t("LOOK")}</h2>
        <Boxed>
          <Row title={t("Mouse colour in the pictures")}>
            <input type="color" className="color-button" value={shell} onChange={(e) => setLook(e.target.value, accent)} aria-label={t("Mouse colour in the pictures")} />
          </Row>
          <ComboRow<string> title={t("Language")} value={choice} onChange={(c) => void setLanguage(c)}
            options={[{ value: "system", label: t("System default") }, ...LANGUAGES.map((l) => ({ value: l.code, label: l.native, lang: l.code.replace("_", "-") }))]} />
        </Boxed>
      </section>

      <Boxed>
        <ButtonRow icon="about" title={f(t("About %s"), APP_NAME)} onClick={showAbout} />
      </Boxed>

      <details className="fold">
        <summary>{t("Advanced")}<Icon name="down" /></summary>
        <div className="fold-body">
          <Boxed>
            <ExpanderRow title={t("Feature table")} subtitle={on && info.features.length ? f(tn("%d feature", "%d features", info.features.length), info.features.length) : ""}>
              {(on ? info.features : []).map((ft) => (
                <Row key={ft.index} title={`0x${hex(ft.id, 4)}`} subtitle={f(t("index %d · v%d · flags 0x%s"), ft.index, ft.version, hex(ft.flags, 2))} />
              ))}
            </ExpanderRow>
            <Row title="Accent colour">
              <input type="color" className="color-button" value={accent} onChange={(e) => setLook(shell, e.target.value)} aria-label="Accent colour" />
            </Row>
            <Row title="HID++ traffic" subtitle="The last requests and answers, newest at the bottom" />
            <pre className="log">{log.slice(-120).join("\n") || "—"}</pre>
            <ButtonRow title="Disconnect" disabled={!connected} onClick={() => void disconnect()} />
          </Boxed>
        </div>
      </details>
    </>
  );
}
