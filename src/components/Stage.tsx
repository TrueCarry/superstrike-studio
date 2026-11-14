// The large mouse at the centre of the studio. Clicking a part opens its settings: a main button
// opens Click, the wheel and side buttons open Buttons, the shell (over the sensor) opens Aim. On the
// Click and Buttons tabs a click picks the button to edit instead.
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import type { Hits } from "../hid/device";
import { t, tc } from "../i18n/i18n";
import { describe, kindOf, makeAction, type Action, type Profile } from "../model/profile";
import { BUTTON_ZONES, shortName, type Zone } from "../model/tables";
import { currentProfile, useStore } from "../state/store";
import { setStudio, useStudio } from "../state/studio";
import { MouseView } from "./MouseView";

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
  const { target, button, layer, view } = useStudio((s) => s);
  const navigate = useNavigate();
  const tab = useLocation().pathname.split("/")[1] || "click";

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
    setStudio({ button: i, view: v });
  };
  const hub = (z: Zone) => {
    if (z === "btn-left" || z === "btn-right") {
      setStudio({ target: z === "btn-left" ? "left" : "right", view: "top" });
      navigate("/click");
    } else {
      pickButton(z);
      navigate("/buttons");
    }
  };
  const toAim = () => navigate("/aim");

  if (tab === "click")
    return (
      <div className="stage-mouse">
        <MouseView view="top" zones={["btn-left", "btn-right"]} callouts="boxes" grid flip={false} thumbnail={false} labelFor={hitsLabel}
          selected={target === "both" ? "" : target === "left" ? "btn-left" : "btn-right"}
          onZone={(z) => setStudio({ target: z === "btn-right" ? "right" : "left" })} onBody={toAim} />
        <p className="ss-hint center">{t("Click a button on the mouse to tune it.")}</p>
      </div>
    );
  if (tab === "buttons")
    return (
      <div className="stage-mouse">
        <MouseView view={view} onView={(v) => setStudio({ view: v })} callouts="lines" flip thumbnail labelFor={actionLabel}
          selected={BUTTON_ZONES[button]} onZone={pickButton} />
        <p className="ss-hint center">{t("Click a button on the mouse to change it. Drag sideways to rotate.")}</p>
      </div>
    );
  return (
    <div className="stage-mouse">
      <MouseView view={view} onView={(v) => setStudio({ view: v })} callouts="none" flip thumbnail onZone={hub} onBody={toAim} />
      <p className="ss-hint center">{t("Click a part of the mouse to open its settings.")}</p>
    </div>
  );
}
