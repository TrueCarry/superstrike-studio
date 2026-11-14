// Profiles panel (upstream page_profiles.cpp): the onboard profiles as a fixed list in slot order, with
// the profile button cycle playing above it, then the feel library. Control mode and backup are on Device.
// Web addition: the factory-state notice.
import { useRef } from "react";
import { useNavigate } from "react-router";
import { FxCard } from "../components/cards";
import { IconButton, MenuButton, Switch } from "../components/controls";
import { Icon } from "../components/icons";
import { f, t, tc } from "../i18n/i18n";
import { Illustration } from "../illustrations/Illustration";
import { download } from "../model/backup";
import { BUILTIN_PRESETS, FACTORY_SECTOR, PRO_PRESETS, hitsCodeDecode, presetName, profileFromJson, profileToJson, type Preset, type Profile } from "../model/profile";
import { applyPreset, copyCode, importCode, saveCurrent, summary } from "../state/hits";
import {
  activateProfile, deletePreset, getState, replaceProfile, setDirEnabled, setEdit, toast, updateProfile, useStore,
} from "../state/store";
import { setStudio, useStudio } from "../state/studio";

/** Opens a file picker and resolves with the chosen file's text. */
export function pickFile(input: HTMLInputElement | null): Promise<string | null> {
  return new Promise((resolve) => {
    if (!input) return resolve(null);
    input.value = "";
    input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
    input.click();
  });
}

const slotText = (i: number) => f(t("Profile %d"), i + 1);
/** [click point, speed 0..1, haptics] for the profile button scene */
const sceneValue = (p: Profile): [number, number, number] => [p.hits[0].act, Math.min(1, (p.stages[p.defaultStage]?.x || 800) / 3200), p.hits[0].hap];

export default function ProfilesPage() {
  const dir = useStore((s) => s.dir);
  const profiles = useStore((s) => s.profiles);
  const blank = useStore((s) => s.blank);
  const factoryEdited = useStore((s) => s.profiles[FACTORY_SECTOR]);
  const fileInput = useRef<HTMLInputElement>(null);
  const cycle = dir.map((e, slot) => ({ e, slot, p: profiles[e.sector] })).filter((x) => x.e.enabled && x.p);

  return (
    <>
      <div className="panel-head">
        <h2>{tc("page", "Profiles")}</h2>
        <span className="spacer" />
        <button className="suggested pill" onClick={() => setStudio({ setup: true })}>{t("Quick setup")}</button>
      </div>
      {blank ? (
        <FxCard title="Factory state" icon="profiles">
          <p className="ss-hint">
            The mouse has no saved profiles yet: it runs on its built-in factory profile, which can not be changed.
            You can still edit every setting here, and HITS changes are felt at once. Your first {t("Save to mouse")} creates
            the onboard profiles, like G HUB does: Profile 1 gets your changes, the others start as copies of the factory profile.
          </p>
          {factoryEdited && <div><button onClick={() => download("profile-factory.json", profileToJson(factoryEdited))}>Export the factory profile…</button></div>}
        </FxCard>
      ) : (
        <FxCard title={t("Profiles")} icon="profiles" value={<>{cycle.length}<small>{f(t("of %d in the cycle"), dir.length)}</small></>}
          scene="profiles" sceneValue={{ values: cycle.map((x) => sceneValue(x.p)), names: cycle.map((x) => x.p.name || slotText(x.slot)) }} tall>
          <p className="ss-hint">{t("Profiles live inside the mouse and work on any computer without this app.")} {t("The profile button steps through the ones in the cycle.")}</p>
          <ol className="profile-list">
            {dir.map((e, slot) => <ProfileRow key={e.sector} slot={slot} fileInput={fileInput} />)}
          </ol>
        </FxCard>
      )}
      <FeelLibrary />
      <input ref={fileInput} type="file" accept=".json,application/json" hidden />
    </>
  );
}

/** One profile: number, name and badges, its summary, then Edit, Activate and More in fixed places. */
function ProfileRow(props: { slot: number; fileInput: React.RefObject<HTMLInputElement | null> }) {
  const { slot } = props;
  const entry = useStore((s) => s.dir[slot]);
  const sector = entry.sector;
  const p = useStore((s) => s.profiles[sector]);
  const active = useStore((s) => s.active === sector);
  const editing = useStore((s) => s.edit === sector);
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
    <li className={`profile-row ${editing ? "editing" : ""}`}>
      <span className="num">{slot + 1}</span>
      <div className="who">
        <input className="name" key={p?.name} defaultValue={p?.name || slotText(slot)} maxLength={24} aria-label={slotText(slot)} disabled={!p}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => rename(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") (e.currentTarget.value = p?.name || slotText(slot)), e.currentTarget.blur();
          }} />
        <div className="badges">
          {active && <span className="ss-badge accent">{tc("profile badge", "Active")}</span>}
          {unsaved && <span className="ss-badge warn">{t("Unsaved")}</span>}
        </div>
        <label className="cycle" title={t("In profile cycle")}>
          <span>{t("In cycle")}</span>
          <Switch checked={entry.enabled} onChange={(v) => setDirEnabled(slot, v)} label={t("In profile cycle")} />
        </label>
      </div>
      <div className="summary" aria-label={t("Summary")}>
        {p && (
          <>
            <span title={t("Actuation")}><Icon name="actuation" />{p.hits[0].act}</span>
            <span title="DPI"><Icon name="sensor" />{p.stages[p.defaultStage]?.x || "—"}</span>
            <span title={t("Haptics")}><Icon name="haptics" />{p.hits[0].hap}</span>
            <span className={p.hits[0].rtOn ? "rt" : "rt off"} title={t("Rapid trigger")}><Icon name="rapid" />{p.hits[0].rtOn ? p.hits[0].rt : "–"}</span>
          </>
        )}
      </div>
      <div className="acts">
        <button disabled={!p || editing} onClick={() => (setEdit(sector), navigate("/click"))}>{editing ? tc("profile card", "Editing") : tc("profile card", "Edit")}</button>
        <button className={active ? "" : "suggested"} disabled={active || !connected || !p} onClick={() => void activateProfile(sector)}>{tc("profile card", "Activate")}</button>
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
    </li>
  );
}

/** Your presets, then the built-in ones, then pro presets: one row each with its click feel playing and Apply. */
function FeelLibrary() {
  const user = useStore((s) => s.presets);
  const target = useStudio((s) => s.target);
  const row = (p: Preset, name: string, onDelete?: () => void) => {
    const v = hitsCodeDecode(p.code);
    if (typeof v === "string") return null;
    const h = v[target === "right" ? 1 : 0];
    return (
      <li key={`${name}:${p.code}`} className="feel-row" title={f(t("HITS code %s"), p.code)}>
        <Illustration scene="feel" value={{ act: h.act, rt: h.rtOn ? h.rt : 0, hap: h.hap, on: target }} label={name} />
        <div className="who">
          <b>{name}</b>
          <span className="ss-hint">{summary(v)}</span>
        </div>
        <div className="acts">
          {onDelete && <IconButton icon="trash" tooltip={t("Delete preset")} onClick={onDelete} />}
          <button onClick={() => applyPreset(name, v)}>{t("Apply")}</button>
        </div>
      </li>
    );
  };
  return (
    <FxCard title={t("Feel library")} icon="hits">
      <p className="ss-hint">{t("Apply a click feel to the profile you are editing. Nothing is written until you save.")}</p>
      <div className="row-head">
        <h4 className="ss-title">{t("YOUR PRESETS")}</h4>
        <span className="spacer" />
        <button className="flat" onClick={() => void saveCurrent()}><Icon name="plus" /> {t("Save current as preset…")}</button>
        <MenuButton icon="code" tooltip={t("HITS code")}>
          {(close) => (
            <>
              <button onClick={() => (close(), void copyCode())}>{t("Copy HITS code")}</button>
              <button onClick={() => (close(), void importCode())}>{t("Import HITS code…")}</button>
            </>
          )}
        </MenuButton>
      </div>
      <ul className="feel-list">
        {user.map((p) => row(p, p.name, () => deletePreset(p.name)))}
        {BUILTIN_PRESETS.map((p) => row(p, presetName(p)))}
      </ul>
      <h4 className="ss-title gap">{t("PRO PRESETS")}</h4>
      <ul className="feel-list">{PRO_PRESETS.map((p) => row(p, p.name))}</ul>
    </FxCard>
  );
}
