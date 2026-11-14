// The large mouse at the centre of the studio. A click on it only picks something inside the open
// panel: the button the click settings apply to on Click, the button to remap on Buttons. On Click a
// "Test clicks" switch turns it into the test area: presses show on the mouse, with clicks per second,
// counts per button and how long the last press was held underneath.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import type { Hits } from "../hid/device";
import { t, tc } from "../i18n/i18n";
import { describe, kindOf, makeAction, type Action, type Profile } from "../model/profile";
import { BUTTON_ZONES, shortName, type Zone } from "../model/tables";
import { currentProfile, useStore } from "../state/store";
import { setStudio, useStudio } from "../state/studio";
import { Switch } from "./controls";
import { MouseView } from "./MouseView";
import { BUTTON_ZONE } from "./useMouseInput";

const rtText = (h: Hits) => (h.rtOn ? String(h.rt) : tc("level value", "off"));

const slotOf = (p: Profile, layer: number, i: number): Action => (layer ? p.shiftButtons : p.buttons)[i];

/** What a button really does: a "Default" slot uses the factory profile's action. */
export function effectiveAction(p: Profile | null, factory: Profile | null, layer: number, i: number): Action {
  const a = p ? slotOf(p, layer, i) : makeAction("default");
  if (kindOf(a) === "default" && factory) {
    const fa = slotOf(factory, layer, i);
    if (kindOf(fa) !== "default") return fa;
  }
  return a;
}

export function Stage() {
  const profile = useStore(currentProfile);
  const factory = useStore((s) => s.factory);
  const { target, button, wheel, layer, view, test } = useStudio((s) => s);
  const tab = useLocation().pathname.split("/")[1] || "click";
  useEffect(() => {
    if (tab !== "click" && test) setStudio({ test: false });
  }, [tab, test]);

  const hitsLabel = useCallback(
    (z: Zone) => {
      if (!profile) return "";
      const h = profile.hits[z === "btn-right" ? 1 : 0];
      return `\x01 ${h.act}\n\x02 ${rtText(h)}\n\x03 ${h.hap}`;
    },
    [profile],
  );
  const actionLabel = useCallback(
    (z: Zone) => {
      const i = BUTTON_ZONES.indexOf(z);
      return i < 0 || !profile ? "" : `${shortName(i)}\n${describe(effectiveAction(profile, factory, layer, i))}`;
    },
    [profile, factory, layer],
  );

  const pickButton = (z: Zone) => {
    const i = BUTTON_ZONES.indexOf(z);
    const v = z === "btn-back" || z === "btn-forward" ? "side" : z === "btn-middle" ? view : "top";
    setStudio({ button: i, wheel: false, view: v });
  };

  let picture;
  if (tab === "click" && test) picture = <TestArea />;
  else if (tab === "click")
    picture = (
      <MouseView view="top" zones={["btn-left", "btn-right"]} callouts="boxes" grid flip={false} thumbnail labelFor={hitsLabel}
        selected={target === "both" ? "" : target === "left" ? "btn-left" : "btn-right"}
        onZone={(z) => setStudio({ target: z === "btn-right" ? "right" : "left" })} />
    );
  else if (tab === "buttons")
    picture = (
      <MouseView view={view} onView={(v) => setStudio({ view: v })} callouts="lines" flip thumbnail labelFor={actionLabel}
        selected={wheel ? "btn-middle" : BUTTON_ZONES[button]} onZone={pickButton} />
    );
  else picture = <MouseView view={view} onView={(v) => setStudio({ view: v })} callouts="none" flip thumbnail />;

  const hint = tab === "click" ? (test ? t("Click anywhere on this side with any button.") : t("Click a button on the mouse to tune it."))
    : tab === "buttons" ? t("Click a button on the mouse to change it. Drag sideways to rotate.")
    : t("Drag sideways to rotate the mouse.");
  return (
    <div className="stage-mouse">
      {picture}
      <div className="stage-foot">
        <p className="ss-hint">{hint}</p>
        {tab === "click" && (
          <label className="test-toggle">
            <span>{t("Test clicks")}</span>
            <Switch checked={test} onChange={(v) => setStudio({ test: v })} label={t("Test clicks")} />
          </label>
        )}
      </div>
    </div>
  );
}

const PAD_ORDER = [0, 2, 1, 3, 4]; // MouseEvent.button -> L, R, M, Back, Fwd counter

/** The click test: the mouse shows every press live; clicks per second, the best second, counts and hold time. */
function TestArea() {
  const [counts, setCounts] = useState([0, 0, 0, 0, 0]);
  const [heldMs, setHeldMs] = useState(0);
  const [best, setBest] = useState(0);
  const [, tick] = useState(0);
  const downAt = useRef<number[]>([]);
  const clicks = useRef<number[]>([]);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  const now = performance.now();
  clicks.current = clicks.current.filter((c) => now - c <= 1000);
  const cps = clicks.current.length;
  const names = [0, 1, 2, 3, 4].map(shortName);
  return (
    <div className="test-area" onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (BUTTON_ZONE[e.button] === undefined) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const at = performance.now();
        downAt.current[e.button] = at;
        clicks.current.push(at);
        setBest((b) => Math.max(b, clicks.current.filter((c) => at - c <= 1000).length));
        setCounts((c) => c.map((v, i) => (i === PAD_ORDER[e.button] ? v + 1 : v)));
      }}
      onPointerUp={(e) => {
        const at = downAt.current[e.button];
        if (at) setHeldMs(Math.round(performance.now() - at));
      }}>
      <MouseView view="top" callouts="none" flip={false} thumbnail />
      <div className="test-stats" aria-live="polite">
        <div className="cps"><b>{cps}</b><span>{t("clicks/s")}</span></div>
        <div><b>{best}</b><span>{t("best")}</span></div>
        <div><b>{heldMs}</b><span>{t("ms held")}</span></div>
        {names.map((n, i) => <div key={n}><b>{counts[i]}</b><span>{n}</span></div>)}
        <button className="flat" onClick={(e) => (e.stopPropagation(), setCounts([0, 0, 0, 0, 0]), setBest(0), setHeldMs(0), (clicks.current = []))}
          onPointerDown={(e) => e.stopPropagation()}>{t("Reset")}</button>
      </div>
    </div>
  );
}
