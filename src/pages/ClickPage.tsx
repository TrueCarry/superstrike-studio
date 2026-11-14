// Click panel (upstream page_hits.cpp): pick the button, then actuation, rapid trigger and haptics,
// each on a card whose animation plays the value set. The test pad counts clicks per second.
import { useEffect, useRef, useState } from "react";
import { FxCard, Segments, Steps } from "../components/cards";
import { IconButton, MenuButton, Switch } from "../components/controls";
import { BUTTON_ZONE } from "../components/useMouseInput";
import type { Hits } from "../hid/device";
import { f, t, tc } from "../i18n/i18n";
import { commit, copyCode, importCode, same } from "../state/hits";
import { currentProfile, useStore } from "../state/store";
import { setStudio, useStudio, type Target } from "../state/studio";

export default function ClickPage() {
  const profile = useStore(currentProfile);
  const target = useStudio((s) => s.target);
  if (!profile) return null;
  const [L, R] = profile.hits;
  const h = target === "right" ? R : L;
  const edit = (fn: (h: Hits) => void) => {
    const n = { ...h };
    fn(n);
    commit([target === "right" ? L : n, target === "left" ? R : n]);
  };
  // both buttons and they differ: show both mice side by side
  const pair = target === "both" && !same(L, R);
  const each = <T,>(get: (x: Hits) => T) => (pair ? [get(L), get(R)] : [get(h)]);

  return (
    <>
      <div className="panel-head">
        <h2>{tc("page", "Click")}</h2>
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
      <Segments<Target> value={target} onChange={(v) => setStudio({ target: v })} label={t("Button")}
        options={[{ value: "left", label: tc("HITS target", "Left") }, { value: "right", label: tc("HITS target", "Right") }, { value: "both", label: t("Both (L+R)") }]} />
      {pair && <span className="ss-badge warn">{t("L and R differ — changes apply to both")}</span>}

      <FxCard title={t("Actuation")} icon="actuation" value={<>{h.act}<small>{f(t("≈ %.1f mm"), h.act * 0.1)}</small></>}
        scene="actuation" sceneValue={{ act: each((x) => x.act) }} tall>
        <p className="ss-hint">{t("Where along the press the click fires. Short = faster, long = fewer misclicks.")}</p>
        <div className="row-head">
          <div style={{ flex: 1 }}>
            <Steps lo={1} hi={10} value={h.act} onChange={(v) => edit((x) => (x.act = v))} label={t("Actuation")}
              loText={tc("travel bar", "Short click")} hiText={tc("travel bar", "Long click")} />
          </div>
          <IconButton icon="rotate" tooltip={t("Reset to 5")} onClick={() => edit((x) => (x.act = 5))} />
        </div>
      </FxCard>

      <FxCard className="rapid" title={t("Rapid trigger")} icon="rapid" value={h.rtOn ? <>{h.rt}<small>{t("of 5")}</small></> : tc("level value", "off")}
        scene="rapid" sceneValue={{ rt: each((x) => (x.rtOn ? x.rt : 0)) }} tall>
        <p className="ss-hint">{t("After a click, lifting the button by this much re-arms it, so fast repeated clicks need less travel.")}</p>
        <div className="row-head">
          <span>{t("Rapid trigger")}</span>
          <span className="spacer" />
          <Switch checked={h.rtOn} onChange={(on) => edit((x) => (x.rtOn = on))} label={t("Rapid trigger")} />
        </div>
        <Steps lo={1} hi={5} value={h.rt} disabled={!h.rtOn} onChange={(v) => edit((x) => (x.rt = v))} label={t("Rapid trigger")}
          loText={tc("rapid trigger level", "Most sensitive")} hiText={tc("rapid trigger level", "Least")} />
      </FxCard>

      <FxCard title={t("Haptics")} icon="haptics" value={h.hap ? <>{h.hap}<small>{t("of 5")}</small></> : tc("level value", "off")}
        scene="haptics" sceneValue={{ level: h.hap }} tall>
        <p className="ss-hint">{t("Click feel strength. Higher levels use more battery.")}</p>
        <Segments<number> value={h.hap} onChange={(v) => edit((x) => (x.hap = v))} label={t("Haptics")}
          options={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: v ? String(v) : tc("haptics level", "Off") }))} />
      </FxCard>

      <TestPad />
    </>
  );
}

const PAD_ORDER = [0, 2, 1, 3, 4]; // MouseEvent.button -> L, R, M, Back, Fwd counter

/** Click here with any button: clicks per second, counts per button, how long the last press was held. */
function TestPad() {
  const [counts, setCounts] = useState([0, 0, 0, 0, 0]);
  const [heldMs, setHeldMs] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [best, setBest] = useState(0);
  const [, tick] = useState(0);
  const downAt = useRef<number[]>([]);
  const clicks = useRef<number[]>([]);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const now = performance.now();
  clicks.current = clicks.current.filter((c) => now - c <= 1000);
  const cps = clicks.current.length;
  return (
    <div className={`ss-pad ${pressed ? "pressed" : ""}`} onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (BUTTON_ZONE[e.button] === undefined) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        downAt.current[e.button] = performance.now();
        clicks.current.push(performance.now());
        setBest((b) => Math.max(b, clicks.current.filter((c) => performance.now() - c <= 1000).length));
        setPressed(true);
        setCounts((c) => c.map((v, i) => (i === PAD_ORDER[e.button] ? v + 1 : v)));
      }}
      onPointerUp={(e) => {
        const at = downAt.current[e.button];
        setPressed(false);
        if (at) setHeldMs(Math.round(performance.now() - at));
      }}>
      <span className="cps"><b>{cps}</b> {t("clicks/s")}</span>
      <span>{t("Test here — click with any button")}</span>
      <span className="ss-hint">{f(t("L %d · R %d · M %d · Back %d · Fwd %d · %d clicks/s · held %d ms"), ...counts, best, heldMs)}</span>
    </div>
  );
}
