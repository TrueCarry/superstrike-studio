// Aim panel (upstream page_sensor.cpp): how the cursor moves. DPI stages, DPI shift, polling rate,
// lift-off distance, angle snapping and surface tuning, each on a card with its animation.
// The scroll filter is on Buttons (Scroll wheel) and the power timers on Device (Battery life).
import { useState } from "react";
import { FxCard, Segments } from "../components/cards";
import { Boxed, SpinRow, SwitchRow } from "../components/controls";
import { f, t, tc } from "../i18n/i18n";
import type { Profile } from "../model/profile";
import { currentProfile, setStage, setSurface, toast, updateProfile, useStore } from "../state/store";

const DEFAULT_DPI = 800;
const STAGES = 5;
const RATE_LABELS = ["125", "250", "500", "1K", "2K", "4K", "8K"];

/** Nearest value of the sorted list. When that is the old value, step one entry in the move direction. */
function snapDpi(list: number[], v: number, prev: number): number {
  if (!list.length) return v;
  const i = list.findIndex((x) => x >= v);
  const hi = i < 0 ? list[list.length - 1] : list[i];
  const lo = i <= 0 ? list[0] : list[i - 1];
  if (hi === v) return v;
  let best = v - lo <= hi - v ? lo : hi;
  if (best === prev && v !== prev) best = v > prev ? hi : lo;
  return best;
}

/** Keeps the default and shift stage on an enabled stage. */
function fixReferences(p: Profile) {
  let first = 0;
  while (first < STAGES - 1 && !p.stages[first].x) first++;
  if (!p.stages[p.defaultStage]?.x) p.defaultStage = first;
  if (!p.stages[p.shiftStage]?.x) p.shiftStage = first;
}

export default function AimPage() {
  const profile = useStore(currentProfile);
  const info = useStore((s) => s.info);
  const live = useStore((s) => s.status === "connected" && s.edit === s.active);
  const [sel, setSel] = useState(() => profile?.defaultStage ?? 0);
  const [separate, setSeparate] = useState<Record<string, boolean>>({});
  if (!profile || !info) return null;

  const st = profile.stages[sel];
  const on = st.x !== 0;
  const sepKey = `${profile.sector}:${sel}`;
  const sep = separate[sepKey] ?? st.x !== st.y;
  const shift = profile.stages[profile.shiftStage];
  const edit = (fn: (p: Profile) => void) => updateProfile(fn);
  const enabledDpi = profile.stages.filter((s) => s.x).map((s) => s.x);

  // Clicking a stage of the active profile switches the mouse to it at once.
  const clickChip = (i: number) => {
    setSel(i);
    if (live && profile.stages[i].x && info.stage !== i) void setStage(i);
  };
  const setEnabled = (v: boolean) => {
    if (v) {
      if (on) return;
      const x = snapDpi(info.dpiList, DEFAULT_DPI, 0);
      updateProfile((p) => (p.stages[sel] = { x, y: x, lod: 2 }));
      setSeparate((s) => ({ ...s, [sepKey]: false }));
    } else {
      if (profile.stages.filter((s) => s.x).length <= 1) return toast(t("At least one stage must stay enabled"));
      updateProfile((p) => {
        p.stages[sel] = { x: 0, y: 0, lod: 0 };
        fixReferences(p);
      });
    }
  };
  const setDpi = (axis: "x" | "y", raw: number) => {
    const v = snapDpi(info.dpiList, raw, st[axis]);
    updateProfile((p) => {
      p.stages[sel][axis] = v;
      if (axis === "x" && !sep) p.stages[sel].y = v;
    });
  };
  const lod = Math.min(3, Math.max(1, st.lod || 2));
  const surface = Math.max(0, info.surface);

  return (
    <>
      <div className="panel-head"><h2>{tc("page", "Aim")}</h2></div>

      <FxCard title={t("DPI stages")} icon="sensor" value={<>{on ? st.x : tc("DPI stage", "off")}<small>DPI</small></>}
        scene="speed" sceneValue={{ dpi: on ? st.x : 0, marks: enabledDpi }} tall>
        <p className="ss-hint">{t("How far the cursor goes for the same hand move. Click a stage to switch the mouse to it now; new values are felt after saving. ★ = stage after power-on.")}</p>
        <div className="stage-chips" role="radiogroup" aria-label={t("DPI stages")}>
          {profile.stages.map((s, i) => (
            <button key={i} role="radio" aria-checked={i === sel} className={`${i === sel ? "on" : ""} ${s.x ? "" : "dim"}`} onClick={() => clickChip(i)}>
              <span className="top">
                <span>{i + 1}</span>
                {profile.defaultStage === i && <span className="ss-star" title={t("Used after power-on")}>★</span>}
                {live && info.stage === i && <span className="inuse" role="img" aria-label={tc("DPI stage", "IN USE")} title={tc("DPI stage", "IN USE")} />}
              </span>
              <span className="dpi">{s.x ? s.x : tc("DPI stage", "off")}</span>
            </button>
          ))}
        </div>
        <Boxed>
          <SwitchRow title={tc("DPI stage", "Enabled")} checked={on} onChange={setEnabled} />
          <SpinRow title="DPI" value={on ? st.x : DEFAULT_DPI} min={100} max={48000} step={50} disabled={!on} onCommit={(v) => setDpi("x", v)} />
          <SwitchRow title={t("Separate X / Y")} checked={sep} disabled={!on} onChange={(v) => {
            setSeparate((s) => ({ ...s, [sepKey]: v }));
            if (!v) edit((p) => (p.stages[sel].y = p.stages[sel].x));
          }} />
          {sep && <SpinRow title={t("DPI Y")} value={on ? st.y : DEFAULT_DPI} min={100} max={48000} step={50} disabled={!on} onCommit={(v) => setDpi("y", v)} />}
          <SwitchRow title={t("Default after power-on")} checked={profile.defaultStage === sel} disabled={!on} onChange={(v) => {
            if (v) edit((p) => (p.defaultStage = sel));
            else toast(t("Pick another stage as the default instead"));
          }} />
        </Boxed>
      </FxCard>

      <FxCard title={t("DPI shift")} icon="buttons" value={<>{shift.x}<small>DPI</small></>} scene="dpi" sceneValue={{ normal: on ? st.x : profile.stages[profile.defaultStage].x, shift: shift.x }} tall>
        <p className="ss-hint">{t("While a button set to DPI shift is held, the mouse slows to this stage for precise aim.")}</p>
        <Segments<number> value={profile.shiftStage} onChange={(v) => edit((p) => (p.shiftStage = v))} label={t("DPI shift")}
          options={profile.stages.map((s, i) => ({ value: i, label: s.x ? String(s.x) : tc("DPI stage", "off"), disabled: !s.x }))} />
      </FxCard>

      <FxCard title={t("Polling rate")} icon="device" value={<>{RATE_LABELS[profile.rateWireless]}<small>Hz</small></>} scene="polling" sceneValue={{ rate: [profile.rateWireless] }} tall>
        <p className="ss-hint">{t("Hz. Higher rates feel smoother and use more battery.")}</p>
        <span className="ss-title">{tc("polling rate", "Wireless")}</span>
        <Segments<number> value={profile.rateWireless} onChange={(v) => edit((p) => (p.rateWireless = v))} label={tc("polling rate", "Wireless")}
          options={RATE_LABELS.map((label, i) => ({ value: i, label }))} />
        <span className="ss-title">{tc("polling rate", "Cable")}</span>
        <Segments<number> value={profile.rateWired} onChange={(v) => edit((p) => (p.rateWired = v))} label={tc("polling rate", "Cable")}
          options={RATE_LABELS.slice(0, 4).map((label, i) => ({ value: i, label }))} />
      </FxCard>

      <FxCard title={t("Lift-off distance")} icon="actuation" scene="lod" sceneValue={{ level: [on ? lod : 2] }} tall
        value={[tc("lift-off distance", "Low"), tc("lift-off distance", "Medium"), tc("lift-off distance", "High")][lod - 1]}>
        <p className="ss-hint">{f(t("How high you can lift the mouse before the cursor stops following it. DPI stage %d."), sel + 1)}</p>
        <Segments<number> value={lod} onChange={(v) => edit((p) => (p.stages[sel].lod = v))} label={t("Lift-off distance")}
          options={[{ value: 1, label: tc("lift-off distance", "Low"), disabled: !on }, { value: 2, label: tc("lift-off distance", "Medium"), disabled: !on }, { value: 3, label: tc("lift-off distance", "High"), disabled: !on }]} />
      </FxCard>

      <FxCard title={t("Angle snapping")} icon="next" scene="snap" sceneValue={{ on: [profile.angleSnap !== 0] }} tall
        value={profile.angleSnap ? tc("surface mode", "On") : tc("level value", "off")}>
        <p className="ss-hint">{t("Straightens near-horizontal and vertical lines")}</p>
        <Segments<number> value={profile.angleSnap ? 1 : 0} onChange={(v) => edit((p) => (p.angleSnap = v))} label={t("Angle snapping")}
          options={[{ value: 0, label: tc("level value", "off") }, { value: 1, label: tc("surface mode", "On") }]} />
      </FxCard>

      <FxCard title={t("Surface tuning")} icon="sensor" scene="surface" sceneValue={{ mode: surface }} tall live
        value={[tc("surface mode", "Auto"), tc("surface mode", "On"), tc("surface mode", "Off")][surface]}>
        <p className="ss-hint">{t("Tunes the sensor to your mousepad for steadier tracking. For the whole mouse, not per profile.")}</p>
        <Segments<number> value={surface} onChange={(v) => void setSurface(v)} label={t("Gaming surface mode")}
          options={[{ value: 0, label: tc("surface mode", "Auto") }, { value: 1, label: tc("surface mode", "On") }, { value: 2, label: tc("surface mode", "Off") }]} />
      </FxCard>
    </>
  );
}
