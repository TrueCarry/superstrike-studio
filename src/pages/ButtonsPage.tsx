// Buttons page (upstream page_buttons.cpp): an action for each of the five buttons, on the normal
// and the DPI-shift layer. The mouse with line callouts on the left, one panel on the right.
import { FxCard, Segments } from "../components/cards";
import { Boxed, ComboRow, Row } from "../components/controls";
import { ask, closeDialog } from "../components/dialogs";
import { effectiveAction } from "../components/Stage";
import { f, t, tc } from "../i18n/i18n";
import { codeOf, describe, kindOf, makeAction, modsOf, type Action, type Kind, type Profile } from "../model/profile";
import { BUTTON_ZONES, FUNCTIONS, KEYS, MEDIA, MODIFIERS, MOUSE_BUTTONS, buttonName, codeToHid, modifierBit, nameText, type Named } from "../model/tables";
import { currentProfile, getState, toast, updateProfile, useStore } from "../state/store";
import { setStudio, useStudio } from "../state/studio";

const KIND_CHIPS: { kind: Kind; label: string }[] = [
  { kind: "mouse", label: "Mouse" }, { kind: "key", label: "Keyboard" }, { kind: "media", label: "Media" },
  { kind: "function", label: "Function" }, { kind: "disabled", label: "Disabled" }, { kind: "default", label: "Default" },
];
const MOD_BITS = MODIFIERS.slice(0, 4); // Ctrl, Shift, Alt, Super

const slotOf = (p: Profile, layer: number, i: number): Action => (layer ? p.shiftButtons : p.buttons)[i];

/** The icon the remapping animation shows for an action. */
function iconOf(a: Action): string {
  const code = codeOf(a);
  switch (kindOf(a)) {
    case "mouse": return "mouse";
    case "key": return (modsOf(a) & 1) && code === 0x06 ? "copy" : "keyboard";
    case "media": return "media";
    case "function": return code >= 0x03 && code <= 0x07 ? "sensor" : code >= 0x08 && code <= 0x0a ? "profiles" : code === 0x0c ? "device" : "mouse";
    case "disabled": return "minus";
    case "raw": return "code";
    default: return "undo";
  }
}
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
  const { button: sel, layer, view } = useStudio((s) => s);
  const setLayer = (v: number) => setStudio({ layer: v });
  const effective = (i: number) => effectiveAction(profile, factory, layer, i);

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
    const z = BUTTON_ZONES[i];
    setStudio({ button: i, view: z === "btn-back" || z === "btn-forward" ? "side" : z === "btn-middle" ? view : "top" });
  };
  const combo = (title: string, table: Named[], k: Kind, search = false) => (
    <Boxed>
      <ComboRow<number> title={title} search={search} value={cur ? codeOf(cur) : 0} onChange={(c) => setAction(actionFor(k, c))}
        options={table.map((n) => ({ value: n.code, label: nameText(table, n) }))} />
    </Boxed>
  );

  return (
    <>
      <div className="panel-head">
        <h2>{tc("page", "Buttons")}</h2>
        <span className="spacer" />
        <Segments<number> value={layer} onChange={setLayer} label={t("Used while a button set to DPI shift is held")}
          options={[{ value: 0, label: tc("button layer", "Normal") }, { value: 1, label: t("DPI-shift layer") }]} />
      </div>
      <Boxed>
        {BUTTON_ZONES.map((z, i) => (
          <Row key={z} title={buttonName(i)} subtitle={profile ? describe(effective(i)) : ""} selected={i === sel} onClick={() => select(i)} />
        ))}
      </Boxed>
      <FxCard title={buttonName(sel)} icon="buttons" value={profile ? <small>{describe(effective(sel))}</small> : undefined}
        scene="remap" sceneValue={{ steps: [[BUTTON_ZONES[sel], iconOf(effective(sel))]] }}>
          <h2 className="ss-title">{t("ACTION")}</h2>
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
      </FxCard>
    </>
  );
}
