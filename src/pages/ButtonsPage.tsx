// Buttons page (upstream page_buttons.cpp): an action for each of the five buttons, on the normal
// and the DPI-shift layer. The mouse with line callouts on the left, one panel on the right.
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { Boxed, ComboRow, IconButton, Row, Toggles } from "../components/controls";
import { ask, closeDialog } from "../components/dialogs";
import { MouseView, type View } from "../components/MouseView";
import { f, t, tc } from "../i18n/i18n";
import { codeOf, describe, kindOf, makeAction, modsOf, type Action, type Kind, type Profile } from "../model/profile";
import { BUTTON_ZONES, FUNCTIONS, KEYS, MEDIA, MODIFIERS, MOUSE_BUTTONS, buttonName, codeToHid, modifierBit, nameText, shortName, type Named, type Zone } from "../model/tables";
import { currentProfile, getState, toast, updateProfile, useStore } from "../state/store";

const KIND_CHIPS: { kind: Kind; label: string }[] = [
  { kind: "mouse", label: "Mouse" }, { kind: "key", label: "Keyboard" }, { kind: "media", label: "Media" },
  { kind: "function", label: "Function" }, { kind: "disabled", label: "Disabled" }, { kind: "default", label: "Default" },
];
const MOD_BITS = MODIFIERS.slice(0, 4); // Ctrl, Shift, Alt, Super

const slotOf = (p: Profile, layer: number, i: number): Action => (layer ? p.shiftButtons : p.buttons)[i];
const hexText = (a: Action) => a.map((b) => b.toString(16).padStart(2, "0")).join(" ");

/** Waits for one key press in an alert dialog. Modifiers held with it become the modifier mask; a modifier alone is recorded on release. */
function recordKey(): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    let pending = -1;
    let result: [number, number] | null = null;
    const finish = (usage: number, mods: number) => {
      result = [usage, mods];
      closeDialog("key");
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      const usage = codeToHid(e.code);
      if (usage < 0) return;
      if (modifierBit(usage)) return void (pending = usage);
      pending = -1;
      finish(usage, (e.ctrlKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0));
    };
    const up = (e: KeyboardEvent) => {
      const usage = codeToHid(e.code);
      if (usage >= 0 && usage === pending) finish(usage, 0);
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    void ask({ heading: t("Press a key"), body: t("Press the key, with Ctrl, Shift, Alt or Super if you want them."), responses: [{ id: "cancel", label: t("Cancel") }] })
      .then(() => {
        window.removeEventListener("keydown", down, true);
        window.removeEventListener("keyup", up, true);
        resolve(result);
      });
  });
}

export default function ButtonsPage() {
  const profile = useStore(currentProfile);
  const factory = useStore((s) => s.factory);
  const [params] = useSearchParams();
  const [sel, setSel] = useState(0);
  const [layer, setLayer] = useState(0);
  const [view, setView] = useState<View>(params.get("view") === "side" ? "side" : "top");

  /** What the button really does: a "Default" slot uses the factory profile's action. */
  const effective = useCallback(
    (i: number): Action => {
      const a = profile ? slotOf(profile, layer, i) : makeAction("default");
      if (kindOf(a) === "default" && factory) {
        const fa = slotOf(factory, layer, i);
        if (kindOf(fa) !== "default") return fa;
      }
      return a;
    },
    [profile, factory, layer],
  );
  const labelFor = useCallback(
    (z: Zone) => {
      const i = BUTTON_ZONES.indexOf(z);
      return i < 0 || !profile ? "" : `${shortName(i)}\n${describe(effective(i))}`;
    },
    [effective, profile],
  );

  const cur = profile ? slotOf(profile, layer, sel) : null;
  const kind = cur ? kindOf(cur) : "default";

  const setAction = (a: Action) => {
    const p = currentProfile(getState());
    if (!p || slotOf(p, layer, sel).every((b, i) => b === a[i])) return;
    updateProfile((q) => ((layer ? q.shiftButtons : q.buttons)[sel] = a));
  };
  /** The action a kind chip or combo stands for, keeping the current choice of that kind. */
  const actionFor = (k: Kind, code?: number, mods?: number): Action => {
    const keep = cur && kindOf(cur) === k ? codeOf(cur) : undefined;
    const first: Partial<Record<Kind, number>> = { mouse: MOUSE_BUTTONS[0].code, key: KEYS[0].code, media: MEDIA[0].code, function: FUNCTIONS[0].code };
    return makeAction(k, code ?? keep ?? first[k] ?? 0, k === "key" ? (mods ?? (cur ? modsOf(cur) : 0)) : 0);
  };
  const select = (i: number) => {
    setSel(i);
    const z = BUTTON_ZONES[i];
    if ((z === "btn-back" || z === "btn-forward") && view === "top") setView("side");
    else if ((z === "btn-left" || z === "btn-right") && view === "side") setView("top");
  };
  const combo = (title: string, table: Named[], k: Kind, search = false) => (
    <Boxed>
      <ComboRow<number> title={title} search={search} value={cur ? codeOf(cur) : 0} onChange={(c) => setAction(actionFor(k, c))}
        options={table.map((n) => ({ value: n.code, label: nameText(table, n) }))} />
    </Boxed>
  );

  return (
    <div className={`split ${profile ? "" : "off"}`}>
      <div className="stage">
        <div className="toolbar">
          <Toggles<View> value={view} onChange={setView} options={[{ value: "top", label: tc("view", "Top") }, { value: "side", label: tc("view", "Left side") }]} />
          <IconButton icon="rotate" tooltip={t("Rotate the mouse")} onClick={() => setView(view === "top" ? "side" : "top")} />
          <span className="spacer" />
          <Toggles<number> value={layer} onChange={setLayer} title={t("Used while a button set to DPI shift is held")}
            options={[{ value: 0, label: tc("button layer", "Normal") }, { value: 1, label: t("DPI-shift layer") }]} />
        </div>
        <MouseView view={view} onView={setView} callouts="lines" flip thumbnail labelFor={labelFor} selected={BUTTON_ZONES[sel]}
          onZone={(z) => select(BUTTON_ZONES.indexOf(z))} />
        <p className="ss-hint center">{t("Click a button on the mouse to change it. Drag sideways to rotate.")}</p>
      </div>
      <section className="ss-panel buttons-panel">
        <div className="scroller">
          <h2 className="ss-title">{t("BUTTONS")}</h2>
          <Boxed>
            {BUTTON_ZONES.map((z, i) => (
              <Row key={z} title={buttonName(i)} subtitle={profile ? describe(effective(i)) : ""} selected={i === sel} onClick={() => select(i)} />
            ))}
          </Boxed>
          <h2 className="ss-title gap">{t("ACTION")}</h2>
          <div className="chips3">
            {KIND_CHIPS.map((c) => (
              <button key={c.kind} className={`ss-chip ${cur && c.kind === kind ? "on" : ""}`} aria-pressed={c.kind === kind}
                onClick={() => c.kind !== kind && setAction(actionFor(c.kind))}>
                {tc("button action", c.label)}
              </button>
            ))}
          </div>
          {kind === "mouse" && combo(t("Mouse button"), MOUSE_BUTTONS, "mouse")}
          {kind === "key" && cur && (
            <>
              <button className="suggested pill" onClick={async () => {
                const k = await recordKey();
                if (!k) return;
                const a = makeAction("key", k[0], k[1]);
                setAction(a);
                toast(f(t("Recorded: %s"), describe(a)));
              }}>{t("Record a key…")}</button>
              <div className="chips4">
                {MOD_BITS.map((m) => {
                  const on = (modsOf(cur) & m.code) !== 0;
                  return (
                    <button key={m.code} className={`ss-chip ${on ? "on" : ""}`} aria-pressed={on}
                      onClick={() => setAction(actionFor("key", codeOf(cur), on ? modsOf(cur) & ~m.code : modsOf(cur) | m.code))}>
                      {nameText(MODIFIERS, m)}
                    </button>
                  );
                })}
              </div>
              {combo(tc("combo row title", "Key"), KEYS, "key", true)}
            </>
          )}
          {kind === "media" && combo(t("Media key"), MEDIA, "media")}
          {kind === "function" && combo(tc("combo row title", "Function"), FUNCTIONS, "function")}
          {kind === "raw" && cur && <Boxed><Row title={t("Macro or custom data (kept as is)")} subtitle={hexText(cur)} /></Boxed>}
          {kind === "default" && profile && <p className="ss-hint">{f(t("Uses the factory action: %s"), describe(effective(sel)))}</p>}
          <button className="flat" disabled={!profile || !factory} onClick={() => factory && setAction(slotOf(factory, layer, sel))}>{t("Restore factory action")}</button>
        </div>
      </section>
    </div>
  );
}
