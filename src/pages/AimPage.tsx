// Sensor page (upstream page_sensor.cpp): DPI stages, polling rate, tracking and power settings
// of the edited profile, one centred column of four panels.
import { useState } from "react";
import { Boxed, Column, ComboRow, Row, SpinRow, SwitchRow, Toggles } from "../components/controls";
import { t, tc } from "../i18n/i18n";
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

export default function SensorPage() {
  const profile = useStore(currentProfile);
  const info = useStore((s) => s.info);
  const live = useStore((s) => s.status === "connected" && s.edit === s.active);
  const [sel, setSel] = useState(0);
  const [separate, setSeparate] = useState<Record<string, boolean>>({});
  if (!profile || !info) return null;

  const st = profile.stages[sel];
  const on = st.x !== 0;
  const sepKey = `${profile.sector}:${sel}`;
  const sep = separate[sepKey] ?? st.x !== st.y;

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
  const edit = (fn: (p: Profile) => void) => updateProfile(fn);

  return (
    <div className="scroll">
      <Column>
        <section className="ss-panel">
          <h2 className="ss-title">{t("DPI STAGES")}</h2>
          <div className="stage-chips" role="radiogroup">
            {profile.stages.map((s, i) => (
              <button key={i} role="radio" aria-checked={i === sel} className={`ss-chip ${i === sel ? "on" : ""} ${s.x ? "" : "dim"}`} onClick={() => clickChip(i)}>
                <span className="top">
                  <span>{i + 1}</span>
                  <span className="ss-star" style={{ opacity: profile.defaultStage === i ? 1 : 0 }} title={t("Used after power-on")}>★</span>
                </span>
                <span className="dpi">{s.x ? s.x : tc("DPI stage", "off")}</span>
                <span className="ss-inuse" style={{ opacity: live && info.stage === i ? 1 : 0 }}>{tc("DPI stage", "IN USE")}</span>
              </button>
            ))}
          </div>
          <p className="ss-hint">{t("Click a stage to switch the mouse to it now. New DPI values are felt after Save to mouse (Ctrl+S) — the mouse takes DPI only from its memory. ★ = stage after power-on.")}</p>
          <Boxed>
            <SwitchRow title={tc("DPI stage", "Enabled")} checked={on} onChange={setEnabled} />
            <SpinRow title="DPI" value={on ? st.x : DEFAULT_DPI} min={100} max={48000} step={50} disabled={!on} onCommit={(v) => setDpi("x", v)} />
            <SwitchRow title={t("Separate X / Y")} checked={sep} disabled={!on} onChange={(v) => {
              setSeparate((s) => ({ ...s, [sepKey]: v }));
              if (!v) edit((p) => (p.stages[sel].y = p.stages[sel].x));
            }} />
            {sep && <SpinRow title={t("DPI Y")} value={on ? st.y : DEFAULT_DPI} min={100} max={48000} step={50} disabled={!on} onCommit={(v) => setDpi("y", v)} />}
            <ComboRow<number> title={t("Lift-off distance")} value={Math.min(3, Math.max(1, st.lod || 2))} disabled={!on} onChange={(v) => edit((p) => (p.stages[sel].lod = v))}
              options={[{ value: 1, label: tc("lift-off distance", "Low") }, { value: 2, label: tc("lift-off distance", "Medium") }, { value: 3, label: tc("lift-off distance", "High") }]} />
            <SwitchRow title={t("Default after power-on")} checked={profile.defaultStage === sel} disabled={!on} onChange={(v) => {
              if (v) edit((p) => (p.defaultStage = sel));
              else toast(t("Pick another stage as the default instead"));
            }} />
          </Boxed>
        </section>

        <section className="ss-panel">
          <h2 className="ss-title">{t("POLLING RATE")}</h2>
          <Boxed>
            <Row title={tc("polling rate", "Wireless")}>
              <Toggles<number> value={profile.rateWireless} onChange={(v) => edit((p) => (p.rateWireless = v))}
                options={RATE_LABELS.map((label, i) => ({ value: i, label }))} />
            </Row>
            <Row title={tc("polling rate", "Cable")}>
              <Toggles<number> value={profile.rateWired} onChange={(v) => edit((p) => (p.rateWired = v))}
                options={RATE_LABELS.slice(0, 4).map((label, i) => ({ value: i, label }))} />
            </Row>
          </Boxed>
          <p className="ss-hint">{t("Hz. Higher rates feel smoother and use more battery.")}</p>
        </section>

        <section className="ss-panel">
          <h2 className="ss-title">{t("TRACKING")}</h2>
          <Boxed>
            <SwitchRow title={t("Angle snapping")} subtitle={t("Straightens near-horizontal and vertical lines")} checked={profile.angleSnap !== 0}
              onChange={(v) => edit((p) => (p.angleSnap = v ? 1 : 0))} />
            <ComboRow<number> title={t("Gaming surface mode")} subtitle={t("Applies at once. Device setting, not per profile")} value={Math.max(0, info.surface)}
              onChange={(v) => void setSurface(v)}
              options={[{ value: 0, label: tc("surface mode", "Auto") }, { value: 1, label: tc("surface mode", "On") }, { value: 2, label: tc("surface mode", "Off") }]} />
            <SpinRow title={t("Scroll filter (ms)")} subtitle={t("Bunny-hop scroll filter, 0 = off")} value={Math.min(profile.scrollFilter, 100) * 10} min={0} max={1000} step={10}
              onCommit={(v) => edit((p) => (p.scrollFilter = Math.round(v / 10)))} />
          </Boxed>
        </section>

        <section className="ss-panel">
          <h2 className="ss-title">{t("POWER")}</h2>
          <Boxed>
            <SpinRow title={t("Low power after (s)")} value={profile.sleepS} min={1} max={3600} step={5} onCommit={(v) => edit((p) => (p.sleepS = v))} />
            <SpinRow title={t("Sleep after (s)")} value={profile.offS} min={10} max={36000} step={30} onCommit={(v) => edit((p) => (p.offS = v))} />
          </Boxed>
        </section>
      </Column>
    </div>
  );
}
