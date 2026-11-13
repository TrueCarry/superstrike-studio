// Buttons: an action for each of the five buttons, on the normal and the DPI-shift layer.
import { useCallback, useEffect, useState } from "react";
import { Panel, Toggles } from "../components/controls";
import { MouseView, ZONES, type View } from "../components/MouseView";
import { useMouseInput } from "../components/useMouseInput";
import { codeOf, describe, kindOf, makeAction, modsOf, type Action, type Kind, type Profile } from "../model/profile";
import { f, t, tc } from "../i18n/i18n";
import { BUTTON_ZONES, FUNCTIONS, KEYS, MEDIA, MODIFIERS, MOUSE_BUTTONS, buttonName, codeToHid, modifierBit, nameText, shortName, type Named, type Zone } from "../model/tables";
import { currentProfile, toast, updateProfile, useStore } from "../state/store";

const KIND_CHIPS: { kind: Kind; label: string }[] = [
  { kind: "mouse", label: "Mouse" }, { kind: "key", label: "Keyboard" }, { kind: "media", label: "Media" },
  { kind: "function", label: "Function" }, { kind: "disabled", label: "Disabled" }, { kind: "default", label: "Default" },
];
const MOD_BITS = MODIFIERS.slice(0, 4); // Ctrl, Shift, Alt, Super

const actionOf = (p: Profile, layer: number, i: number): Action => (layer ? p.shiftButtons[i] : p.buttons[i]);

export default function ButtonsPage() {
  const profile = useStore(currentProfile);
  const factory = useStore((s) => s.factory);
  const [sel, setSel] = useState(0);
  const [layer, setLayer] = useState(0);
  const [view, setView] = useState<View>("top");
  const [recording, setRecording] = useState(false);
  const { pressed, wheelTick } = useMouseInput();

  /** What the button really does: a "Default" slot uses the factory profile's action. */
  const effective = useCallback(
    (i: number): Action => {
      const a = profile ? actionOf(profile, layer, i) : makeAction("default");
      if (kindOf(a) === "default" && factory) {
        const f = actionOf(factory, layer, i);
        if (kindOf(f) !== "default") return f;
      }
      return a;
    },
    [profile, factory, layer],
  );
  const labelFor = useCallback((z: Zone) => {
    const i = BUTTON_ZONES.indexOf(z);
    return `${shortName(i)}\n${describe(effective(i))}`;
  }, [effective]);

  if (!profile) return null;
  const cur = actionOf(profile, layer, sel);
  const kind = kindOf(cur);

  const setAction = (a: Action) =>
    updateProfile((p) => {
      (layer ? p.shiftButtons : p.buttons)[sel] = a;
    });

  const setKind = (k: Kind) => {
    if (k === kind) return;
    const first: Record<Kind, number> = { mouse: MOUSE_BUTTONS[0].code, key: KEYS[0].code, media: MEDIA[0].code, function: FUNCTIONS[0].code, default: 0, disabled: 0, raw: 0 };
    setAction(makeAction(k, first[k]));
  };

  const pickZone = (z: Zone) => setSel(BUTTON_ZONES.indexOf(z));

  return (
    <div className="page buttons-page">
      <div className="stage">
        <div className="stage-tools">
          <Toggles<View> value={view} onChange={setView} options={[{ value: "top", label: tc("view", "Top") }, { value: "side", label: tc("view", "Left side") }]} />
          <Toggles<number> value={layer} onChange={setLayer} options={[{ value: 0, label: tc("button layer", "Normal") }, { value: 1, label: t("DPI-shift layer") }]} />
        </div>
        <MouseView view={view} selected={BUTTON_ZONES[sel]} onZone={pickZone} labelFor={labelFor} pressed={pressed} wheelTick={wheelTick} />
        <p className="hint center">{layer ? t("Used while a button set to DPI shift is held") : t("Click a button on the picture to change it.")}</p>
      </div>
      <div className="col">
        <Panel title={t("BUTTONS")}>
          <div className="list">
            {BUTTON_ZONES.map((zone, i) => (
              <button key={zone} className={`list-row ${i === sel ? "on" : ""}`} onClick={() => {
                setSel(i);
                if (!ZONES[view].includes(BUTTON_ZONES[i])) setView(view === "top" ? "side" : "top");
              }}>
                <span>{buttonName(i)}</span>
                <small>{describe(effective(i))}</small>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={buttonName(sel).toUpperCase()}>
          <div className="chips">
            {KIND_CHIPS.map((c) => (
              <button key={c.kind} className={`chip ${c.kind === kind ? "on" : ""}`} onClick={() => setKind(c.kind)}>{tc("button action", c.label)}</button>
            ))}
          </div>
          {kind === "mouse" && <NamedSelect title={t("Mouse button")} table={MOUSE_BUTTONS} value={codeOf(cur)} onChange={(c) => setAction(makeAction("mouse", c))} />}
          {kind === "media" && <NamedSelect title={t("Media key")} table={MEDIA} value={codeOf(cur)} onChange={(c) => setAction(makeAction("media", c))} />}
          {kind === "function" && <NamedSelect title={tc("combo row title", "Function")} table={FUNCTIONS} value={codeOf(cur)} onChange={(c) => setAction(makeAction("function", c))} />}
          {kind === "key" && (
            <>
              <NamedSelect title={tc("combo row title", "Key")} table={KEYS} value={codeOf(cur)} onChange={(c) => setAction(makeAction("key", c, modsOf(cur)))} />
              <div className="mods">
                {MOD_BITS.map((m) => (
                  <label key={m.code}>
                    <input type="checkbox" checked={(modsOf(cur) & m.code) !== 0}
                      onChange={(e) => setAction(makeAction("key", codeOf(cur), e.target.checked ? modsOf(cur) | m.code : modsOf(cur) & ~m.code))} />
                    {nameText(MODIFIERS, m)}
                  </label>
                ))}
              </div>
              <button className="suggested" onClick={() => setRecording(true)}>{t("Record a key…")}</button>
            </>
          )}
          {kind === "raw" && <p className="hint">{t("Macro or custom data (kept as is)")}: {describe(cur)}</p>}
          {kind === "default" && <p className="hint">{f(t("Uses the factory action: %s"), describe(effective(sel)))}</p>}
          {kind === "disabled" && <p className="hint">{tc("button action", "Disabled")}</p>}
        </Panel>
      </div>
      {recording && (
        <KeyRecorder onCancel={() => setRecording(false)} onKey={(usage, mods) => {
          const a = makeAction("key", usage, mods);
          setAction(a);
          setRecording(false);
          toast(f(t("Recorded: %s"), describe(a)));
        }} />
      )}
    </div>
  );
}

function NamedSelect(props: { title: string; table: Named[]; value: number; onChange: (code: number) => void }) {
  const known = props.table.some((n) => n.code === props.value);
  return (
    <label className="field">
      <span>{props.title}</span>
      <select value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}>
        {!known && <option value={props.value}>0x{props.value.toString(16)}</option>}
        {props.table.map((n) => (
          <option key={n.code} value={n.code}>{nameText(props.table, n)}</option>
        ))}
      </select>
    </label>
  );
}

/** Waits for one key press. Modifiers held with it become the modifier mask; a modifier alone is recorded on release. */
function KeyRecorder(props: { onKey: (usage: number, mods: number) => void; onCancel: () => void }) {
  useEffect(() => {
    let lastModifier = -1;
    const modsOfEvent = (e: KeyboardEvent) => (e.ctrlKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const usage = codeToHid(e.code);
      if (usage < 0) return toast(`That key (${e.code}) can not be assigned`, "error");
      if (modifierBit(usage)) return void (lastModifier = usage);
      props.onKey(usage, modsOfEvent(e));
    };
    const up = (e: KeyboardEvent) => {
      const usage = codeToHid(e.code);
      if (usage === lastModifier && usage >= 0) props.onKey(usage, 0);
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, [props]);
  return (
    <div className="modal-backdrop" onClick={props.onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("Press a key")}</h2>
        <p>{t("Press the key, with Ctrl, Shift, Alt or Super if you want them.")}</p>
        <p className="hint">Some combinations (like Ctrl+W) are kept by the browser and can not be recorded; pick them from the list instead.</p>
        <button onClick={props.onCancel}>{t("Cancel")}</button>
      </div>
    </div>
  );
}
