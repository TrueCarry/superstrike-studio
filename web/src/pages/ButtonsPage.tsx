// Buttons: an action for each of the five buttons, on the normal and the DPI-shift layer.
import { useCallback, useEffect, useState } from "react";
import { Panel, Toggles } from "../components/controls";
import { MouseView, ZONES, type View } from "../components/MouseView";
import { useMouseInput } from "../components/useMouseInput";
import { codeOf, describe, kindOf, makeAction, modsOf, type Action, type Kind, type Profile } from "../model/profile";
import { BUTTON_NAMES, BUTTON_ZONES, FUNCTIONS, KEYS, MEDIA, MOUSE_BUTTONS, SHORT_NAMES, codeToHid, modifierBit, type Named, type Zone } from "../model/tables";
import { currentProfile, toast, updateProfile, useStore } from "../state/store";

const KIND_CHIPS: { kind: Kind; label: string }[] = [
  { kind: "mouse", label: "Mouse" }, { kind: "key", label: "Keyboard" }, { kind: "media", label: "Media" },
  { kind: "function", label: "Function" }, { kind: "disabled", label: "Disabled" }, { kind: "default", label: "Default" },
];
const MOD_BITS = [{ bit: 0x01, name: "Ctrl" }, { bit: 0x02, name: "Shift" }, { bit: 0x04, name: "Alt" }, { bit: 0x08, name: "Super" }];

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
    return `${SHORT_NAMES[i]}\n${describe(effective(i))}`;
  }, [effective]);

  if (!profile) return <p className="hint">No profile loaded.</p>;
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
          <Toggles<View> value={view} onChange={setView} options={[{ value: "top", label: "Top" }, { value: "side", label: "Left side" }]} />
          <Toggles<number> value={layer} onChange={setLayer} options={[{ value: 0, label: "Normal" }, { value: 1, label: "DPI-shift layer" }]} />
        </div>
        <MouseView view={view} selected={BUTTON_ZONES[sel]} onZone={pickZone} labelFor={labelFor} pressed={pressed} wheelTick={wheelTick} />
        <p className="hint center">Click a button on the picture to change it.{layer ? " The DPI-shift layer is used while a button set to DPI shift is held." : ""}</p>
      </div>
      <div className="col">
        <Panel title="BUTTONS">
          <div className="list">
            {BUTTON_NAMES.map((name, i) => (
              <button key={name} className={`list-row ${i === sel ? "on" : ""}`} onClick={() => {
                setSel(i);
                if (!ZONES[view].includes(BUTTON_ZONES[i])) setView(view === "top" ? "side" : "top");
              }}>
                <span>{name}</span>
                <small>{describe(effective(i))}</small>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title={BUTTON_NAMES[sel].toUpperCase()}>
          <div className="chips">
            {KIND_CHIPS.map((c) => (
              <button key={c.kind} className={`chip ${c.kind === kind ? "on" : ""}`} onClick={() => setKind(c.kind)}>{c.label}</button>
            ))}
          </div>
          {kind === "mouse" && <NamedSelect title="Mouse button" table={MOUSE_BUTTONS} value={codeOf(cur)} onChange={(c) => setAction(makeAction("mouse", c))} />}
          {kind === "media" && <NamedSelect title="Media key" table={MEDIA} value={codeOf(cur)} onChange={(c) => setAction(makeAction("media", c))} />}
          {kind === "function" && <NamedSelect title="Function" table={FUNCTIONS} value={codeOf(cur)} onChange={(c) => setAction(makeAction("function", c))} />}
          {kind === "key" && (
            <>
              <NamedSelect title="Key" table={KEYS} value={codeOf(cur)} onChange={(c) => setAction(makeAction("key", c, modsOf(cur)))} />
              <div className="mods">
                {MOD_BITS.map((m) => (
                  <label key={m.bit}>
                    <input type="checkbox" checked={(modsOf(cur) & m.bit) !== 0}
                      onChange={(e) => setAction(makeAction("key", codeOf(cur), e.target.checked ? modsOf(cur) | m.bit : modsOf(cur) & ~m.bit))} />
                    {m.name}
                  </label>
                ))}
              </div>
              <button className="suggested" onClick={() => setRecording(true)}>Record a key…</button>
            </>
          )}
          {kind === "raw" && <p className="hint">{describe(cur)}. Choose a type above to replace it.</p>}
          {kind === "default" && <p className="hint">Uses the factory action: {describe(effective(sel))}</p>}
          {kind === "disabled" && <p className="hint">This button does nothing.</p>}
        </Panel>
      </div>
      {recording && (
        <KeyRecorder onCancel={() => setRecording(false)} onKey={(usage, mods) => {
          const a = makeAction("key", usage, mods);
          setAction(a);
          setRecording(false);
          toast(`Recorded: ${describe(a)}`);
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
        {!known && <option value={props.value}>Unknown (0x{props.value.toString(16)})</option>}
        {props.table.map((n) => (
          <option key={n.code} value={n.code}>{n.name}</option>
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
        <h2>Press a key</h2>
        <p>Press the key, with Ctrl, Shift, Alt or Super if you want them.</p>
        <p className="hint">Some combinations (like Ctrl+W) are kept by the browser and can not be recorded; pick them from the list instead.</p>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    </div>
  );
}
