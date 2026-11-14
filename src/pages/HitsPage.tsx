// HITS page (upstream page_hits.cpp): actuation, rapid trigger and haptics per button, presets,
// HITS codes, test pad. Panel on the left, the mouse with boxed callouts on the right.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Boxed, IconButton, LevelBar, MenuButton, Row, SwitchRow, Toggles, TravelBar } from "../components/controls";
import { entryDialog } from "../components/dialogs";
import { BUTTON_ZONE } from "../components/useMouseInput";
import type { Hits } from "../hid/device";
import { f, t, tc } from "../i18n/i18n";
import { BUILTIN_PRESETS, PRO_PRESETS, hitsCodeDecode, hitsCodeEncode, presetName, type Preset } from "../model/profile";
import { currentProfile, deletePreset, getState, liveHits, savePreset, toast, updateProfile, useStore } from "../state/store";
import { setStudio, useStudio, type Target } from "../state/studio";

type Tab = "act" | "rt" | "hap" | "presets";
const TABS: Tab[] = ["act", "rt", "hap", "presets"];

const clampHits = (h: Hits): Hits => ({
  act: Math.min(10, Math.max(1, h.act)),
  rt: Math.min(5, Math.max(1, h.rt)),
  rtOn: h.rtOn,
  hap: Math.min(5, Math.max(0, h.hap)),
});
/** Short value shown in the big number and in the callout boxes: the level, or "off". */
const rtText = (h: Hits) => (h.rtOn ? String(h.rt) : tc("level value", "off"));
const same = (a: Hits, b: Hits) => a.act === b.act && a.rt === b.rt && a.rtOn === b.rtOn && a.hap === b.hap;

function summary(h: [Hits, Hits]) {
  const pair = (get: (x: Hits) => string) => (get(h[0]) === get(h[1]) ? get(h[0]) : `${get(h[0])} / ${get(h[1])}`);
  return f(t("Actuation %s   Rapid trigger %s   Haptics %s"), pair((x) => String(x.act)), pair(rtText), pair((x) => String(x.hap)));
}

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

function applyPreset(name: string, v: [Hits, Hits]) {
  if (!currentProfile(getState())) return;
  commit(v);
  toast(f(t('Preset "%s" applied. Press Save to mouse to keep it.'), name));
}

async function copyCode() {
  const p = currentProfile(getState());
  if (!p) return;
  const code = hitsCodeEncode(p.hits);
  await navigator.clipboard?.writeText(code).catch(() => undefined);
  toast(f(t("HITS code copied: %s"), code));
}

async function importCode() {
  const text = await entryDialog(t("Import HITS code"), t("Paste a HITS code from G HUB, a pro player or a friend."), "MDAwNjA2MDEwMTExMDUwMw==", t("Apply"));
  if (text === null) return;
  const v = hitsCodeDecode(text);
  if (typeof v === "string") return toast(v ? f(t("Not a valid HITS code: %s"), v) : t("Not a valid HITS code"), "error");
  applyPreset(t("HITS code"), v);
}

async function saveCurrent() {
  const name = await entryDialog(t("Save HITS preset"), t("Name for the current left and right button settings."), t("My preset"), t("Save"));
  const p = currentProfile(getState());
  if (!name || !p) return;
  savePreset(name, hitsCodeEncode(p.hits));
  toast(f(t('Preset "%s" saved'), name));
}

export default function HitsPage() {
  const profile = useStore(currentProfile);
  const [params] = useSearchParams();
  const target = useStudio((s) => s.target);
  const setTarget = (v: Target) => setStudio({ target: v });
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "act"));

  const L = profile?.hits[0], R = profile?.hits[1];
  const h = (target === "right" ? R : L) ?? { act: 5, rt: 2, rtOn: false, hap: 3 };
  const edit = (fn: (h: Hits) => void) => {
    if (!L || !R) return;
    const n = { ...h };
    fn(n);
    commit([target === "right" ? L : n, target === "left" ? R : n]);
  };

  return (
    <>
      <section className={`ss-panel hits-panel ${profile ? "" : "off"}`}>
        <div className="head">
          <h2 className="ss-title">{t("HITS CONFIGURATION")}</h2>
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
        <Toggles<Target> wide value={target} onChange={setTarget}
          options={[{ value: "left", label: tc("HITS target", "Left") }, { value: "right", label: tc("HITS target", "Right") }, { value: "both", label: t("Both (L+R)") }]} />
        {target === "both" && L && R && !same(L, R) && <span className="ss-badge warn">{t("L and R differ — changes apply to both")}</span>}
        <div className="switcher" role="tablist">
          {TABS.map((id) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {tc("HITS tab", { act: "Actuation", rt: "Rapid", hap: "Haptics", presets: "Presets" }[id])}
            </button>
          ))}
        </div>
        <div className="tabpage" key={tab}>
          {tab === "act" && (
            <>
              <p className="ss-hint">{t("Where along the press the click fires. Short = faster, long = fewer misclicks.")}</p>
              <ValueRow value={String(h.act)} unit={f(t("≈ %.1f mm"), h.act * 0.1)}>
                <IconButton icon="rotate" tooltip={t("Reset to 5")} onClick={() => edit((x) => (x.act = 5))} />
              </ValueRow>
              <TravelBar act={h.act} rt={h.rt} rtOn={false} onChange={(a) => edit((x) => (x.act = a))} />
            </>
          )}
          {tab === "rt" && (
            <>
              <Boxed><SwitchRow title={t("Rapid trigger")} checked={h.rtOn} onChange={(on) => edit((x) => (x.rtOn = on))} /></Boxed>
              <ValueRow value={rtText(h)} unit={h.rtOn ? t("of 5") : ""} />
              <LevelBar lo={1} hi={5} value={h.rt} disabled={!h.rtOn} loText={tc("rapid trigger level", "Most sensitive")} hiText={tc("rapid trigger level", "Least")}
                onChange={(v) => edit((x) => (x.rt = v))} />
              <TravelBar act={h.act} rt={h.rt} rtOn={h.rtOn} onChange={(a, r) => edit((x) => ((x.act = a), x.rtOn && (x.rt = r)))} />
              <p className="ss-hint">{t("After a click, lifting the button by this much re-arms it, so fast repeated clicks need less travel.")}</p>
            </>
          )}
          {tab === "hap" && (
            <>
              <ValueRow value={h.hap ? String(h.hap) : tc("level value", "off")} unit={h.hap ? t("of 5") : ""} />
              <LevelBar lo={0} hi={5} value={h.hap} loText={tc("haptics level", "Off")} hiText={tc("haptics level", "Strongest")} onChange={(v) => edit((x) => (x.hap = v))} />
              <p className="ss-hint">{t("Click feel strength. Higher levels use more battery.")}</p>
            </>
          )}
          {tab === "presets" && <Presets />}
        </div>
      </section>
      <TestPad />
    </>
  );
}

function ValueRow(props: { value: string; unit: string; children?: React.ReactNode }) {
  return (
    <div className="value-row">
      <span className="ss-value">{props.value}</span>
      <span className="ss-unit">{props.unit}</span>
      {props.children}
    </div>
  );
}

function Presets() {
  const user = useStore((s) => s.presets);
  const row = (p: Preset, name: string, onDelete?: () => void) => {
    const v = hitsCodeDecode(p.code);
    if (typeof v === "string") return null;
    return (
      <Row key={`${name}:${p.code}`} title={name} subtitle={summary(v)} tooltip={f(t("HITS code %s"), p.code)} onClick={() => applyPreset(name, v)}>
        {onDelete && <IconButton icon="trash" tooltip={t("Delete preset")} onClick={onDelete} />}
      </Row>
    );
  };
  return (
    <>
      <h3 className="ss-title">{t("YOUR PRESETS")}</h3>
      <Boxed>
        {BUILTIN_PRESETS.map((p) => row(p, presetName(p)))}
        {user.map((p) => row(p, p.name, () => deletePreset(p.name)))}
      </Boxed>
      <button onClick={() => void saveCurrent()}>{t("Save current as preset…")}</button>
      <h3 className="ss-title gap">{t("PRO PRESETS")}</h3>
      <Boxed>{PRO_PRESETS.map((p) => row(p, p.name))}</Boxed>
    </>
  );
}

const PAD_ORDER = [0, 2, 1, 3, 4]; // MouseEvent.button -> L, R, M, Back, Fwd counter

/** Click here with any button: counts per button, clicks per second, how long the last press was held. */
function TestPad() {
  const [counts, setCounts] = useState([0, 0, 0, 0, 0]);
  const [heldMs, setHeldMs] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [, tick] = useState(0);
  const downAt = useRef<number[]>([]);
  const clicks = useRef<number[]>([]);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const now = performance.now();
  clicks.current = clicks.current.filter((c) => now - c <= 1000);
  return (
    <div className={`ss-pad ${pressed ? "pressed" : ""}`} onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (BUTTON_ZONE[e.button] === undefined) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        downAt.current[e.button] = performance.now();
        clicks.current.push(performance.now());
        setPressed(true);
        setCounts((c) => c.map((v, i) => (i === PAD_ORDER[e.button] ? v + 1 : v)));
      }}
      onPointerUp={(e) => {
        const at = downAt.current[e.button];
        setPressed(false);
        if (at) setHeldMs(Math.round(performance.now() - at));
      }}>
      <span>{t("Test here — click with any button")}</span>
      <span className="ss-hint">{f(t("L %d · R %d · M %d · Back %d · Fwd %d · %d clicks/s · held %d ms"), ...counts, clicks.current.length, heldMs)}</span>
    </div>
  );
}
