// HITS: actuation, rapid trigger and haptics per button, presets, HITS codes, test pad.
import { useCallback, useEffect, useRef, useState } from "react";
import { LevelBar, Panel, Switch, Toggles, TravelBar } from "../components/controls";
import { MouseView } from "../components/MouseView";
import { BUTTON_ZONE, useMouseInput } from "../components/useMouseInput";
import type { Hits } from "../hid/device";
import { f, t, tc } from "../i18n/i18n";
import { BUILTIN_PRESETS, PRO_PRESETS, hitsCodeDecode, hitsCodeEncode, presetName, type Preset } from "../model/profile";
import type { Zone } from "../model/tables";
import { currentProfile, deletePreset, getState, liveHits, savePreset, toast, updateProfile, useStore } from "../state/store";

type Target = "left" | "right" | "both";
type Tab = "act" | "rt" | "hap" | "presets";

const clampHits = (h: Hits): Hits => ({
  act: Math.min(10, Math.max(1, h.act)),
  rt: Math.min(5, Math.max(1, h.rt)),
  rtOn: h.rtOn,
  hap: Math.min(5, Math.max(0, h.hap)),
});
const rtText = (h: Hits) => (h.rtOn ? String(h.rt) : tc("level value", "off"));
const same = (a: Hits, b: Hits) => a.act === b.act && a.rt === b.rt && a.rtOn === b.rtOn && a.hap === b.hap;

/** Applies both buttons' HITS to the edited profile, and to the mouse now when it is the active one. */
function commit(v: [Hits, Hits]) {
  const p = currentProfile(getState());
  if (!p) return;
  const next: [Hits, Hits] = [clampHits(v[0]), clampHits(v[1])];
  const changed = [0, 1].filter((b) => !same(p.hits[b], next[b]));
  if (!changed.length) return;
  updateProfile((q) => (q.hits = next));
  void liveHits(changed);
}

function summary(code: string) {
  const h = hitsCodeDecode(code);
  if (typeof h === "string") return h;
  const pair = (f: (x: Hits) => string) => (f(h[0]) === f(h[1]) ? f(h[0]) : `${f(h[0])} / ${f(h[1])}`);
  return f(t("Actuation %s   Rapid trigger %s   Haptics %s"), pair((x) => String(x.act)), pair(rtText), pair((x) => String(x.hap)));
}

export default function HitsPage() {
  const profile = useStore(currentProfile);
  const presets = useStore((s) => s.presets);
  const isActive = useStore((s) => s.edit === s.active);
  const [target, setTarget] = useState<Target>("both");
  const [tab, setTab] = useState<Tab>("act");
  const { pressed, wheelTick } = useMouseInput();

  const labelFor = useCallback(
    (z: Zone) => {
      if (!profile || (z !== "btn-left" && z !== "btn-right")) return "";
      const b = z === "btn-left" ? 0 : 1;
      const h = profile.hits[b];
      return [tc("HITS target", b ? "Right" : "Left"), `${tc("HITS tab", "Actuation")} ${h.act}`, `${t("Rapid trigger")} ${rtText(h)}`, `${tc("HITS tab", "Haptics")} ${h.hap ? h.hap : tc("level value", "off")}`].join("\n");
    },
    [profile],
  );

  if (!profile) return null;
  const [L, R] = profile.hits;
  const h = target === "right" ? R : L;
  const differ = target === "both" && !same(L, R);

  const edit = (fn: (h: Hits) => void) => {
    const n = { ...h };
    fn(n);
    commit([target === "right" ? L : n, target === "left" ? R : n]);
  };

  const applyPreset = (p: Preset) => {
    const v = hitsCodeDecode(p.code);
    if (typeof v === "string") return toast(v, "error");
    commit(v);
    toast(f(t('Preset "%s" applied. Press Save to mouse to keep it.'), presetName(p)));
  };

  return (
    <div className="page hits-page">
      <div className="stage">
        <MouseView view="top" boxes labelFor={labelFor} pressed={pressed} wheelTick={wheelTick}
          selected={target === "both" ? undefined : target === "left" ? "btn-left" : "btn-right"}
          onZone={(z) => z !== "btn-middle" && setTarget(z === "btn-left" ? "left" : "right")} />
        <TestPad />
      </div>
      <div className="col">
        <Panel title={t("HITS CONFIGURATION")} extra={<CodeMenu hits={[L, R]} />}>
          {!isActive && <p className="badge warn">{f(t("%s · not active"), t("The profile you are editing"))}</p>}
          <Toggles<Target> value={target} onChange={setTarget} options={[{ value: "left", label: tc("HITS target", "Left") }, { value: "right", label: tc("HITS target", "Right") }, { value: "both", label: t("Both (L+R)") }]} />
          {differ && <p className="badge warn">{t("L and R differ — changes apply to both")}</p>}
          <Toggles<Tab> value={tab} onChange={setTab} options={[{ value: "act", label: tc("HITS tab", "Actuation") }, { value: "rt", label: tc("HITS tab", "Rapid") }, { value: "hap", label: tc("HITS tab", "Haptics") }, { value: "presets", label: tc("HITS tab", "Presets") }]} />

          {tab === "act" && (
            <div className="tab">
              <div className="big">
                {h.act} <small>{f(t("≈ %.1f mm"), h.act * 0.1)}</small>
                <button className="flat" onClick={() => edit((x) => (x.act = 5))} title={t("Reset to 5")} aria-label={t("Reset to 5")}>↺</button>
              </div>
              <TravelBar act={h.act} rt={h.rt} rtOn={h.rtOn} onChange={(v) => edit((x) => (x.act = v))} />
              <p className="hint">{t("Where along the press the click fires. Short = faster, long = fewer misclicks.")}</p>
            </div>
          )}
          {tab === "rt" && (
            <div className="tab">
              <label className="inline">
                {t("Rapid trigger")} <Switch checked={h.rtOn} onChange={(v) => edit((x) => (x.rtOn = v))} label={t("Rapid trigger")} />
              </label>
              <div className="big">{h.rtOn ? <>{h.rt} <small>{t("of 5")}</small></> : tc("level value", "off")}</div>
              <LevelBar lo={1} hi={5} value={h.rt} disabled={!h.rtOn} loText={tc("rapid trigger level", "Most sensitive")} hiText={tc("rapid trigger level", "Least")} onChange={(v) => edit((x) => (x.rt = v))} />
              <p className="hint">{t("After a click, lifting the button by this much re-arms it, so fast repeated clicks need less travel.")}</p>
            </div>
          )}
          {tab === "hap" && (
            <div className="tab">
              <div className="big">{h.hap ? <>{h.hap} <small>{t("of 5")}</small></> : tc("level value", "off")}</div>
              <LevelBar lo={0} hi={5} value={h.hap} loText={tc("haptics level", "Off")} hiText={tc("haptics level", "Strongest")} onChange={(v) => edit((x) => (x.hap = v))} />
              <p className="hint">{t("Click feel strength. Higher levels use more battery.")}</p>
            </div>
          )}
          {tab === "presets" && (
            <div className="tab presets">
              <h3>{t("YOUR PRESETS")}</h3>
              {presets.length === 0 && <p className="hint">None yet.</p>}
              {presets.map((p) => (
                <PresetRow key={p.name} preset={p} onApply={applyPreset} onDelete={() => deletePreset(p.name)} />
              ))}
              <button onClick={() => {
                const name = prompt(`${t("Save HITS preset")}\n${t("Name for the current left and right button settings.")}`, t("My preset"))?.trim();
                if (!name) return;
                savePreset(name, hitsCodeEncode([L, R]));
                toast(f(t('Preset "%s" saved'), name));
              }}>{t("Save current as preset…")}</button>
              <h3>{tc("button action", "Default").toUpperCase()}</h3>
              {BUILTIN_PRESETS.map((p) => <PresetRow key={p.name} preset={p} onApply={applyPreset} />)}
              <h3>{t("PRO PRESETS")}</h3>
              {PRO_PRESETS.map((p) => <PresetRow key={p.name} preset={p} onApply={applyPreset} />)}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PresetRow(props: { preset: Preset; onApply: (p: Preset) => void; onDelete?: () => void }) {
  return (
    <div className="preset" role="button" tabIndex={0} onClick={() => props.onApply(props.preset)} onKeyDown={(e) => e.key === "Enter" && props.onApply(props.preset)}>
      <div>
        <div>{presetName(props.preset)}</div>
        <small>{summary(props.preset.code)}</small>
      </div>
      {props.onDelete && (
        <button className="flat" title={t("Delete preset")} aria-label={t("Delete preset")} onClick={(e) => (e.stopPropagation(), props.onDelete?.())}>✕</button>
      )}
    </div>
  );
}

function CodeMenu(props: { hits: [Hits, Hits] }) {
  return (
    <div className="code-menu">
      <button className="flat" onClick={async () => {
        const code = hitsCodeEncode(props.hits);
        await navigator.clipboard.writeText(code).catch(() => prompt("HITS code:", code));
        toast(f(t("HITS code copied: %s"), code));
      }}>{t("Copy HITS code")}</button>
      <button className="flat" onClick={() => {
        const code = prompt(`${t("Import HITS code")}\n${t("Paste a HITS code from G HUB, a pro player or a friend.")}`);
        if (!code) return;
        const v = hitsCodeDecode(code);
        if (typeof v === "string") return toast(f(t("Not a valid HITS code: %s"), v), "error");
        commit(v);
        toast(f(t("HITS code %s"), code.trim()));
      }}>{t("Import HITS code…")}</button>
    </div>
  );
}

/** Click here with any button: counts per button, clicks per second, how long the last press was held. */
function TestPad() {
  const [counts, setCounts] = useState([0, 0, 0, 0, 0]);
  const [heldMs, setHeldMs] = useState(0);
  const [rate, setRate] = useState(0);
  const downAt = useRef<number[]>([]);
  const clicks = useRef<number[]>([]);
  useEffect(() => {
    const t = setInterval(() => {
      const now = performance.now();
      clicks.current = clicks.current.filter((c) => now - c < 1000);
      setRate(clicks.current.length);
    }, 100);
    return () => clearInterval(t);
  }, []);
  const order = [0, 2, 1, 3, 4]; // MouseEvent.button -> L, R, M, Back, Fwd counter
  return (
    <div className="pad" onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (!BUTTON_ZONE[e.button]) return;
        downAt.current[e.button] = performance.now();
        clicks.current.push(performance.now());
        setCounts((c) => c.map((v, i) => (i === order.indexOf(e.button) ? v + 1 : v)));
      }}
      onPointerUp={(e) => {
        const t = downAt.current[e.button];
        if (t) setHeldMs(Math.round(performance.now() - t));
      }}>
      <div>{t("Test here — click with any button")}</div>
      <small>{f(t("L %d · R %d · M %d · Back %d · Fwd %d · %d clicks/s · held %d ms"), ...counts, rate, heldMs)}</small>
    </div>
  );
}
