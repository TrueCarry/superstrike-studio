// Device panel (upstream page_device.cpp, plus control mode and backup from page_profiles.cpp): is my mouse
// OK? Five cards: the mouse, battery life, backup, saved profiles and the app; developer tools under More.
// Not ported: "Check for updates" (the web page is always the latest version).
import { useRef, useState } from "react";
import { FxCard } from "../components/cards";
import { Boxed, ButtonRow, ExpanderRow, Row, SpinRow, Switch } from "../components/controls";
import { ask, confirmDialog } from "../components/dialogs";
import { Icon } from "../components/icons";
import { MODE_HOST, MODE_ONBOARD, batteryStateText } from "../hid/device";
import { f, LANGUAGES, setLanguage, systemLanguage, t, tc, tn, useLanguage } from "../i18n/i18n";
import { download, listAutoBackups, stamp } from "../model/backup";
import { backupNow, currentProfile, disconnect, restoreBackup, revert, setControlMode, setLook, toast, updateProfile, useStore } from "../state/store";
import { pickFile } from "./ProfilesPage";

const hex = (n: number, w: number) => n.toString(16).toUpperCase().padStart(w, "0");
const VERSION = "0.1.0";
const APP_NAME = "SuperStrike Studio Plus";
const nativeName = (code: string) => LANGUAGES.find((l) => l.code === code)?.native ?? code;

/** Language picker: a globe and the language's own name. "Auto · English" follows the system. */
export function LanguagePicker() {
  const { choice } = useLanguage();
  return (
    <span className="combo lang-picker">
      <Icon name="globe" />
      <select value={choice} onChange={(e) => void setLanguage(e.target.value)} aria-label={t("Language")} title={t("Language")}>
        <option value="system">{f(t("Auto · %s"), nativeName(systemLanguage()))}</option>
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
  const on = connected && !!info;
  const o = info?.onboard;
  const battery = !on || info.battery < 0 ? "—" : info.batteryState ? f(t("%d %% · %s"), info.battery, batteryStateText(info.batteryState)) : f(t("%d %%"), info.battery);
  const link = on ? (info.index === 0xff ? t("USB cable") : f(t("LIGHTSPEED receiver slot %d"), info.index)) : "";
  const memory = on && o
    ? `${f(tn("%d profile", "%d profiles", o.profiles), o.profiles)} · ${f(t("format %d"), o.format)} · ${f(tn("%d sector × %d bytes", "%d sectors × %d bytes", o.sectors), o.sectors, o.sectorSize)}`
    : "";

  return (
    <>
      <div className="panel-head"><h2>{tc("page", "Device")}</h2></div>

      <FxCard title={on ? info.name : "PRO X3 SUPERSTRIKE"} icon="mouse" value={on && info.battery >= 0 ? <>{info.battery}<small>%</small></> : undefined}>
        <div className="device-lines">
          <span>{battery} · {link}</span>
          <span className="ss-hint">{f(t("Firmware %s"), on ? info.firmware.join(", ") : "—")}{memory && ` · ${memory}`}</span>
        </div>
        <div><button disabled={!connected} onClick={() => void revert()}><Icon name="refresh" /> {t("Reload from mouse")}</button></div>
      </FxCard>

      <BatteryLife />
      <BackupCard />
      <SavedProfiles />
      <AppCard />

      <h3 className="ss-title more-head">{t("More")}</h3>
      <Developer />
    </>
  );
}

/** Low power and sleep timers. They are stored per profile, so they belong to the profile being edited. */
function BatteryLife() {
  const p = useStore(currentProfile);
  const dir = useStore((s) => s.dir);
  if (!p) return null;
  const slot = dir.findIndex((e) => e.sector === p.sector);
  const name = p.name || (slot >= 0 ? f(t("Profile %d"), slot + 1) : t("Factory profile"));
  return (
    <FxCard title={t("Battery life")} icon="device" scene="power" sceneValue={{ low: p.sleepS, sleep: p.offS }} tall
      value={<small>{name}</small>}>
      <p className="ss-hint">{f(t("When the mouse dims to save power and when it goes to sleep. Saved with %s."), name)}</p>
      <Boxed>
        <SpinRow title={t("Low power after (s)")} value={p.sleepS} min={0} max={65535} step={10} onCommit={(v) => updateProfile((q) => (q.sleepS = v))} />
        <SpinRow title={t("Sleep after (s)")} value={p.offS} min={0} max={65535} step={30} onCommit={(v) => updateProfile((q) => (q.offS = v))} />
      </Boxed>
    </FxCard>
  );
}

/** Back up and restore the whole memory; the automatic backups are kept in this browser. */
function BackupCard() {
  const connected = useStore((s) => s.status === "connected");
  const fileInput = useRef<HTMLInputElement>(null);
  const [autoBackups, setAutoBackups] = useState(listAutoBackups);
  const [all, setAll] = useState(false);
  const confirmRestore = async (text: string, what: string) => {
    const body = f(t("This overwrites the profiles in the mouse with the contents of %s. The current memory is saved to the backup folder first."), what);
    if (!(await confirmDialog(t("Restore memory?"), body, t("Restore"), "destructive"))) return;
    await restoreBackup(text);
    setAutoBackups(listAutoBackups());
  };
  const shown = all ? autoBackups : autoBackups.slice(0, 1);
  return (
    <FxCard title={t("Backup")} icon="save">
      <p className="ss-hint">{f(t("The app also makes a full backup automatically before the first save of each session, in %s."), "this browser")}</p>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden />
      <div className="button-row">
        <button disabled={!connected} onClick={async () => {
          const text = await backupNow();
          if (!text) return;
          const name = `superstrike-backup-${stamp()}.json`;
          download(name, text);
          toast(f(t("Backup saved: %s"), name));
        }}>{t("Back up whole memory…")}</button>
        <button disabled={!connected} onClick={async () => {
          const text = await pickFile(fileInput.current);
          if (text !== null) await confirmRestore(text, fileInput.current?.files?.[0]?.name ?? "the chosen file");
        }}>{t("Restore from backup…")}</button>
      </div>
      {shown.length > 0 && (
        <Boxed>
          {shown.map((b) => (
            <Row key={b.time} title={`Automatic backup ${b.time}`}>
              <button className="flat" onClick={() => download(`superstrike-auto-${b.time.replace(/[: ]/g, "-")}.json`, b.json)}>Download</button>
              <button className="flat" disabled={!connected} onClick={() => void confirmRestore(b.json, `the automatic backup from ${b.time}`)}>{t("Restore")}</button>
            </Row>
          ))}
          {autoBackups.length > 1 && <ButtonRow title={all ? t("Show less") : f(t("Show all (%d)"), autoBackups.length)} onClick={() => setAll(!all)} />}
        </Boxed>
      )}
    </FxCard>
  );
}

/** On: the mouse runs on its onboard profiles (onboard memory). Off: host mode, software controls it. */
function SavedProfiles() {
  const mode = useStore((s) => s.info?.mode ?? MODE_ONBOARD);
  const connected = useStore((s) => s.status === "connected");
  const onboard = mode !== MODE_HOST;
  return (
    <FxCard title={t("Saved profiles")} icon="profiles" live>
      <div className="row-head">
        <p className="ss-hint" style={{ flex: 1 }}>{t("When off, the mouse ignores its saved profiles while software on the computer controls it.")}</p>
        <Switch checked={onboard} disabled={!connected} onChange={(v) => void setControlMode(v ? MODE_ONBOARD : MODE_HOST)} label={t("Use saved profiles")} />
      </div>
    </FxCard>
  );
}

function AppCard() {
  const shell = useStore((s) => s.shell);
  const accent = useStore((s) => s.accent);
  return (
    <FxCard title={t("App")} icon="about">
      <Boxed>
        <Row title={t("Language")}><LanguagePicker /></Row>
        <Row title={t("Mouse colour in the pictures")}>
          <input type="color" className="color-button" value={shell} onChange={(e) => setLook(e.target.value, accent)} aria-label={t("Mouse colour in the pictures")} />
        </Row>
        <Row title={t("Accent colour")}>
          <input type="color" className="color-button" value={accent} onChange={(e) => setLook(shell, e.target.value)} aria-label={t("Accent colour")} />
        </Row>
        <ButtonRow icon="about" title={f(t("About %s"), APP_NAME)} onClick={showAbout} />
      </Boxed>
    </FxCard>
  );
}

function Developer() {
  const info = useStore((s) => s.info);
  const connected = useStore((s) => s.status === "connected");
  const log = useStore((s) => s.log);
  const on = connected && !!info;
  return (
    <FxCard title={t("Developer")} icon="code">
      <Boxed>
        <ExpanderRow title={t("Feature table")} subtitle={on && info.features.length ? f(tn("%d feature", "%d features", info.features.length), info.features.length) : ""}>
          {(on ? info.features : []).map((ft) => (
            <Row key={ft.index} title={`0x${hex(ft.id, 4)}`} subtitle={f(t("index %d · v%d · flags 0x%s"), ft.index, ft.version, hex(ft.flags, 2))} />
          ))}
        </ExpanderRow>
        <ExpanderRow title="HID++ traffic" subtitle="The last requests and answers, newest at the bottom">
          <pre className="log">{log.slice(-120).join("\n") || "—"}</pre>
        </ExpanderRow>
        <ButtonRow title={t("Disconnect")} disabled={!connected} onClick={() => void disconnect()} />
      </Boxed>
    </FxCard>
  );
}
