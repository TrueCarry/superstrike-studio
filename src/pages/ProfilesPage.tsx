// Profiles: onboard profile cards, control mode, backup and restore.
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Panel, Row, Switch } from "../components/controls";
import { MODE_HOST, MODE_ONBOARD } from "../hid/device";
import { f, t, tc } from "../i18n/i18n";
import { download, listAutoBackups, stamp, type StoredBackup } from "../model/backup";
import { FACTORY_SECTOR, profileFromJson, profileToJson } from "../model/profile";
import {
  activateProfile, backupNow, replaceProfile, restoreBackup, setControlMode, setDirEnabled, setEdit, toast, updateProfile, useStore,
} from "../state/store";

/** Opens a file picker and resolves with the chosen file's text. */
function pickFile(input: HTMLInputElement | null): Promise<string | null> {
  return new Promise((resolve) => {
    if (!input) return resolve(null);
    input.value = "";
    input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
    input.click();
  });
}

export default function ProfilesPage() {
  const dir = useStore((s) => s.dir);
  const profiles = useStore((s) => s.profiles);
  const factory = useStore((s) => s.factory);
  const active = useStore((s) => s.active);
  const edit = useStore((s) => s.edit);
  const dirty = useStore((s) => s.dirty);
  const mode = useStore((s) => s.info?.mode ?? MODE_ONBOARD);
  const blank = useStore((s) => s.blank);
  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [autoBackups, setAutoBackups] = useState(listAutoBackups);

  const confirmRestore = async (text: string, what: string) => {
    if (!confirm(`${t("Restore memory?")}\n\nThis overwrites the profiles in the mouse with the contents of ${what}. The current memory is saved as an automatic backup first.`)) return;
    await restoreBackup(text);
    setAutoBackups(listAutoBackups());
  };

  if (blank) {
    const p = profiles[FACTORY_SECTOR];
    return (
      <div className="page">
        <Panel title="FACTORY STATE">
          <p>
            The mouse has no saved profiles yet: it runs on its built-in factory profile, which can not be changed.
            You can still edit every setting here, and HITS changes are felt at once. Your first <strong>{t("Save to mouse")}</strong>{" "}
            creates the onboard profiles, like G HUB does: Profile 1 gets your changes, the others start as copies of the factory profile.
          </p>
          {p && <button onClick={() => download("profile-factory.json", profileToJson(p))}>Export the factory profile…</button>}
        </Panel>
        <BackupPanel fileInput={fileInput} autoBackups={autoBackups} confirmRestore={confirmRestore} />
        <input ref={fileInput} type="file" accept=".json,application/json" hidden />
      </div>
    );
  }

  return (
    <div className="page">
      <p className="hint">{t("Profiles live inside the mouse and work on any computer without this app.")}</p>
      <div className="cards">
        {dir.map((e, slot) => {
          const p = profiles[e.sector];
          if (!p) return null;
          return (
            <div key={e.sector} className={`card ${e.sector === edit ? "editing" : ""}`}>
              <div className="card-head">
                <h3>{f(t("Profile %d"), slot + 1)}</h3>
                {e.sector === active && <span className="badge accent">{tc("profile badge", "Active")}</span>}
                {dirty.includes(e.sector) && <span className="badge warn">{t("Unsaved")}</span>}
              </div>
              <input className="name" value={p.name} maxLength={24} placeholder="(no name)" aria-label={f(t("Profile %d"), slot + 1)}
                onChange={(ev) => updateProfile((q) => (q.name = ev.target.value), e.sector)} />
              <Row title={t("In profile cycle")}>
                <Switch checked={e.enabled} onChange={(v) => setDirEnabled(slot, v)} label={t("In profile cycle")} />
              </Row>
              <div className="card-actions">
                <button onClick={() => (setEdit(e.sector), navigate("/hits"))}>{tc("profile card", "Edit")}</button>
                <button disabled={e.sector === active} onClick={() => void activateProfile(e.sector)}>{tc("profile card", "Activate")}</button>
                <details className="menu">
                  <summary title={t("More actions")} aria-label={t("More actions")}>⋯</summary>
                  <div className="menu-items">
                    <button disabled={!factory} onClick={() => {
                      if (!factory) return;
                      replaceProfile(e.sector, factory);
                      toast(f(t("Profile %d reset to factory. Save to write it"), slot + 1));
                    }}>{t("Reset to factory")}</button>
                    <button onClick={() => download(`profile-${(p.name || `profile-${slot + 1}`).replace(/[^\w.-]+/g, "_")}.json`, profileToJson(p))}>{t("Export…")}</button>
                    <button onClick={async () => {
                      const text = await pickFile(fileInput.current);
                      if (text === null) return;
                      const q = profileFromJson(p, text);
                      if (!q) return toast(t("Not a valid profile file"), "error");
                      replaceProfile(e.sector, q);
                      updateProfile((x) => (x.name = q.name), e.sector);
                      toast(f(t("Imported into Profile %d. Save to write it"), slot + 1));
                    }}>{t("Import…")}</button>
                    <small>{t("Copy settings from")}</small>
                    {dir.map((src, j) =>
                      j === slot ? null : (
                        <button key={src.sector} onClick={() => {
                          replaceProfile(e.sector, profiles[src.sector]);
                          toast(f(t("Copied Profile %d into Profile %d. Save to keep it"), j + 1, slot + 1));
                        }}>{f(t("Profile %d"), j + 1)}</button>
                      ),
                    )}
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </div>

      <Panel title={t("CONTROL MODE")}>
        <Row title={t("Who controls the mouse")}>
          <select value={mode === MODE_HOST ? MODE_HOST : MODE_ONBOARD} onChange={(e) => void setControlMode(Number(e.target.value))}>
            <option value={MODE_ONBOARD}>{t("Onboard memory (recommended)")}</option>
            <option value={MODE_HOST}>{t("Host software")}</option>
          </select>
        </Row>
      </Panel>

      <BackupPanel fileInput={fileInput} autoBackups={autoBackups} confirmRestore={confirmRestore} />
      <input ref={fileInput} type="file" accept=".json,application/json" hidden />
    </div>
  );
}

function BackupPanel(props: {
  fileInput: React.RefObject<HTMLInputElement | null>;
  autoBackups: StoredBackup[];
  confirmRestore: (text: string, what: string) => Promise<void>;
}) {
  return (
    <Panel title={t("BACKUP")}>
      <div className="list">
        <button className="list-row" onClick={async () => {
          const text = await backupNow();
          if (text) download(`superstrike-backup-${stamp()}.json`, text);
        }}>
          <span>{t("Back up whole memory…")}</span>
          <small>{t("All profiles, the directory and the factory profile, to a file")}</small>
        </button>
        <button className="list-row" onClick={async () => {
          const text = await pickFile(props.fileInput.current);
          if (text !== null) await props.confirmRestore(text, "the chosen file");
        }}>
          <span>{t("Restore from backup…")}</span>
          <small>{t("Writes the saved sectors back into the mouse")}</small>
        </button>
      </div>
      <p className="hint">The app also keeps a full backup in this browser before the first save of each session, and before every restore.</p>
      {props.autoBackups.length > 0 && (
        <div className="list">
          {props.autoBackups.map((b) => (
            <div key={b.time} className="list-row static">
              <span>Automatic backup {b.time}</span>
              <span className="row-buttons">
                <button className="flat" onClick={() => download(`superstrike-auto-${b.time.replace(/[: ]/g, "-")}.json`, b.json)}>Download</button>
                <button className="flat" onClick={() => void props.confirmRestore(b.json, `the automatic backup from ${b.time}`)}>{t("Restore")}</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
