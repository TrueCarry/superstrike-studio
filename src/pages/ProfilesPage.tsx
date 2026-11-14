// Profiles page (upstream page_profiles.cpp): onboard profile cards, control mode, backup and restore.
// Web additions: the factory-state notice, and automatic backups kept in this browser (native wrote them to a folder).
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Boxed, ComboRow, IconButton, MenuButton, Row, Switch } from "../components/controls";
import { confirmDialog } from "../components/dialogs";
import { Icon } from "../components/icons";
import { MODE_HOST, MODE_ONBOARD } from "../hid/device";
import { f, t, tc } from "../i18n/i18n";
import { Illustration } from "../illustrations/Illustration";
import { download, listAutoBackups, stamp, type StoredBackup } from "../model/backup";
import { BUILTIN_PRESETS, FACTORY_SECTOR, PRO_PRESETS, hitsCodeDecode, presetName, profileFromJson, profileToJson, type Preset } from "../model/profile";
import { applyPreset, copyCode, importCode, saveCurrent, summary } from "../state/hits";
import {
  activateProfile, backupNow, deletePreset, getState, replaceProfile, restoreBackup, setControlMode, setDirEnabled, setEdit, toast, updateProfile, useStore,
} from "../state/store";
import { setStudio, useStudio } from "../state/studio";

/** Opens a file picker and resolves with the chosen file's text. */
function pickFile(input: HTMLInputElement | null): Promise<string | null> {
  return new Promise((resolve) => {
    if (!input) return resolve(null);
    input.value = "";
    input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
    input.click();
  });
}

const slotText = (i: number) => f(t("Profile %d"), i + 1);

export default function ProfilesPage() {
  const dir = useStore((s) => s.dir);
  const blank = useStore((s) => s.blank);
  const factoryEdited = useStore((s) => s.profiles[FACTORY_SECTOR]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [autoBackups, setAutoBackups] = useState(listAutoBackups);

  const confirmRestore = async (text: string, what: string) => {
    const body = f(t("This overwrites the profiles in the mouse with the contents of %s. The current memory is saved to the backup folder first."), what);
    if (!(await confirmDialog(t("Restore memory?"), body, t("Restore"), "destructive"))) return;
    await restoreBackup(text);
    setAutoBackups(listAutoBackups());
  };

  return (
    <>
      <div className="panel-head">
        <h2>{tc("page", "Profiles")}</h2>
        <span className="spacer" />
        <button className="suggested pill" onClick={() => setStudio({ setup: true })}>{t("Quick setup")}</button>
      </div>
        {blank ? (
          <section className="ss-panel">
            <h2 className="ss-title">FACTORY STATE</h2>
            <p className="ss-hint">
              The mouse has no saved profiles yet: it runs on its built-in factory profile, which can not be changed.
              You can still edit every setting here, and HITS changes are felt at once. Your first {t("Save to mouse")} creates
              the onboard profiles, like G HUB does: Profile 1 gets your changes, the others start as copies of the factory profile.
            </p>
            {factoryEdited && <div><button onClick={() => download("profile-factory.json", profileToJson(factoryEdited))}>Export the factory profile…</button></div>}
          </section>
        ) : (
          <>
            <p className="ss-hint">{t("Profiles live inside the mouse and work on any computer without this app.")}</p>
            <div className="cards">
              {dir.map((e, slot) => <Card key={e.sector} slot={slot} fileInput={fileInput} />)}
            </div>
          </>
        )}
        <FeelLibrary />
        <ControlMode />
        <BackupPanel fileInput={fileInput} autoBackups={autoBackups} confirmRestore={confirmRestore} />
        <input ref={fileInput} type="file" accept=".json,application/json" hidden />
    </>
  );
}

/** Built-in, own and pro presets, each card playing its own click feel. A click applies it to the edited profile. */
function FeelLibrary() {
  const user = useStore((s) => s.presets);
  const target = useStudio((s) => s.target);
  const card = (p: Preset, name: string, onDelete?: () => void) => {
    const v = hitsCodeDecode(p.code);
    if (typeof v === "string") return null;
    const h = v[target === "right" ? 1 : 0];
    return (
      <div key={`${name}:${p.code}`} className="feel-card" role="button" tabIndex={0} title={f(t("HITS code %s"), p.code)}
        onClick={() => applyPreset(name, v)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), applyPreset(name, v))}>
        <Illustration scene="feel" value={{ act: h.act, rt: h.rtOn ? h.rt : 0, hap: h.hap }} label={name} />
        <div className="feel-name">
          <span>{name}</span>
          {onDelete && <IconButton icon="trash" tooltip={t("Delete preset")} onClick={onDelete} />}
        </div>
        <span className="ss-hint">{summary(v)}</span>
      </div>
    );
  };
  return (
    <section className="fx-card">
      <div className="fx-body">
        <div className="fx-head">
          <Icon name="hits" />
          <h3>{t("Feel library")}</h3>
          <span className="spacer" />
          <MenuButton icon="code" tooltip={t("HITS code")}>
            {(close) => (
              <>
                <button onClick={() => (close(), void copyCode())}>{t("Copy HITS code")}</button>
                <button onClick={() => (close(), void importCode())}>{t("Import HITS code…")}</button>
              </>
            )}
          </MenuButton>
        </div>
        <p className="ss-hint">{t("Click a feel to try it on the profile you are editing.")}</p>
        <h4 className="ss-title">{t("YOUR PRESETS")}</h4>
        <div className="feel-grid">
          {BUILTIN_PRESETS.map((p) => card(p, presetName(p)))}
          {user.map((p) => card(p, p.name, () => deletePreset(p.name)))}
        </div>
        <button onClick={() => void saveCurrent()}>{t("Save current as preset…")}</button>
        <h4 className="ss-title gap">{t("PRO PRESETS")}</h4>
        <div className="feel-grid">{PRO_PRESETS.map((p) => card(p, p.name))}</div>
      </div>
    </section>
  );
}

function Card(props: { slot: number; fileInput: React.RefObject<HTMLInputElement | null> }) {
  const { slot } = props;
  const entry = useStore((s) => s.dir[slot]);
  const sector = entry.sector;
  const p = useStore((s) => s.profiles[sector]);
  const active = useStore((s) => s.active === sector);
  const unsaved = useStore((s) => s.dirty.includes(sector));
  const connected = useStore((s) => s.status === "connected");
  const count = useStore((s) => s.dir.length);
  const navigate = useNavigate();

  const rename = (text: string) => {
    let name = text.trim();
    if (name === slotText(slot)) name = "";
    name = [...name].slice(0, 24).join("");
    if (p && name !== p.name) updateProfile((q) => (q.name = name), sector);
  };
  const resetFactory = () => {
    const factory = getState().factory;
    if (!factory) return toast(t("Factory profile not loaded"));
    replaceProfile(sector, factory);
    updateProfile((q) => (q.name = factory.name), sector);
    toast(f(t("Profile %d reset to factory. Save to write it"), slot + 1));
  };
  const exportProfile = () => {
    if (!p) return;
    const base = (p.name || `slot${slot + 1}`).replace(/ /g, "_").replace(/[^\w.-]+/g, "_");
    download(`profile-${base}.json`, profileToJson(p));
    toast(f(t("Exported to %s"), `profile-${base}.json`));
  };
  const importProfile = async () => {
    const text = await pickFile(props.fileInput.current);
    if (text === null || !p) return;
    const q = profileFromJson(p, text);
    if (!q) return toast(t("Not a valid profile file"));
    replaceProfile(sector, q);
    updateProfile((x) => (x.name = q.name), sector);
    toast(f(t("Imported into Profile %d. Save to write it"), slot + 1));
  };
  const copyFrom = (j: number) => {
    const src = getState().profiles[getState().dir[j].sector];
    if (!src) return;
    replaceProfile(sector, src);
    toast(f(t("Copied Profile %d into Profile %d. Save to keep it"), j + 1, slot + 1));
  };

  return (
    <section className="ss-panel card">
      <div className="top">
        <span className="ss-value">{slot + 1}</span>
        <span className="spacer" />
        {active && <span className="ss-badge accent">{tc("profile badge", "Active")}</span>}
        {unsaved && <span className="ss-badge warn">{t("Unsaved")}</span>}
      </div>
      {p && (
        <div className="summary" aria-label={t("Summary")}>
          <span title={t("Actuation")}><Icon name="actuation" />{p.hits[0].act}</span>
          <span title="DPI"><Icon name="sensor" />{p.stages[p.defaultStage]?.x || "—"}</span>
          <span title={t("Haptics")}><Icon name="haptics" />{p.hits[0].hap}</span>
          {p.hits[0].rtOn && <span className="rt" title={t("Rapid trigger")}><Icon name="rapid" />{p.hits[0].rt}</span>}
        </div>
      )}
      <input className="name" key={p?.name} defaultValue={p?.name || slotText(slot)} maxLength={24} aria-label={slotText(slot)} disabled={!p}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => rename(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") (e.currentTarget.value = p?.name || slotText(slot)), e.currentTarget.blur();
        }} />
      <div className="line">
        <span>{t("In profile cycle")}</span>
        <span className="spacer" />
        <Switch checked={entry.enabled} onChange={(v) => setDirEnabled(slot, v)} label={t("In profile cycle")} />
      </div>
      <div className="foot">
        <button disabled={!p} onClick={() => (setEdit(sector), navigate("/click"))}>{tc("profile card", "Edit")}</button>
        <button className={active ? "" : "suggested"} disabled={active || !connected || !p} onClick={() => void activateProfile(sector)}>{tc("profile card", "Activate")}</button>
        <span className="spacer" />
        <MenuButton icon="more" tooltip={t("More actions")}>
          {(close) => (
            <>
              <button onClick={() => (close(), resetFactory())}>{t("Reset to factory")}</button>
              <button onClick={() => (close(), exportProfile())}>{t("Export…")}</button>
              <button onClick={() => (close(), void importProfile())}>{t("Import…")}</button>
              <hr />
              <span className="ss-hint">{t("Copy settings from")}</span>
              {Array.from({ length: count }, (_, j) => j).filter((j) => j !== slot).map((j) => (
                <button key={j} onClick={() => (close(), copyFrom(j))}>{slotText(j)}</button>
              ))}
            </>
          )}
        </MenuButton>
      </div>
    </section>
  );
}

function ControlMode() {
  const mode = useStore((s) => s.info?.mode ?? MODE_ONBOARD);
  const connected = useStore((s) => s.status === "connected");
  const options = [{ value: MODE_ONBOARD, label: t("Onboard memory (recommended)") }, { value: MODE_HOST, label: t("Host software") }];
  return (
    <section className="ss-panel">
      <h2 className="ss-title">{t("CONTROL MODE")}</h2>
      <Boxed>
        <ComboRow<number> title={t("Who controls the mouse")} value={mode === MODE_HOST ? MODE_HOST : MODE_ONBOARD} disabled={!connected}
          options={options} onChange={(m) => void setControlMode(m)} />
      </Boxed>
    </section>
  );
}

function BackupPanel(props: {
  fileInput: React.RefObject<HTMLInputElement | null>;
  autoBackups: StoredBackup[];
  confirmRestore: (text: string, what: string) => Promise<void>;
}) {
  const connected = useStore((s) => s.status === "connected");
  return (
    <section className="ss-panel">
      <h2 className="ss-title">{t("BACKUP")}</h2>
      <Boxed>
        <Row title={t("Back up whole memory…")} subtitle={t("All profiles, the directory and the factory profile, to a file")} chevron disabled={!connected}
          onClick={async () => {
            const text = await backupNow();
            if (!text) return;
            const name = `superstrike-backup-${stamp()}.json`;
            download(name, text);
            toast(f(t("Backup saved: %s"), name));
          }} />
        <Row title={t("Restore from backup…")} subtitle={t("Writes the saved sectors back into the mouse")} chevron disabled={!connected}
          onClick={async () => {
            const text = await pickFile(props.fileInput.current);
            if (text !== null) await props.confirmRestore(text, props.fileInput.current?.files?.[0]?.name ?? "the chosen file");
          }} />
      </Boxed>
      <p className="ss-hint">{f(t("The app also makes a full backup automatically before the first save of each session, in %s."), "this browser")}</p>
      {props.autoBackups.length > 0 && (
        <Boxed>
          {props.autoBackups.map((b) => (
            <Row key={b.time} title={`Automatic backup ${b.time}`}>
              <button className="flat" onClick={() => download(`superstrike-auto-${b.time.replace(/[: ]/g, "-")}.json`, b.json)}>Download</button>
              <button className="flat" disabled={!connected} onClick={() => void props.confirmRestore(b.json, `the automatic backup from ${b.time}`)}>{t("Restore")}</button>
            </Row>
          ))}
        </Boxed>
      )}
    </section>
  );
}
