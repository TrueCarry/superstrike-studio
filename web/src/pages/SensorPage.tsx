// Sensor: DPI stages, polling rate, tracking and power.
import { useState } from "react";
import { NumberField, Panel, Row, Switch, Toggles } from "../components/controls";
import { RATES_HZ } from "../hid/device";
import type { Profile } from "../model/profile";
import { currentProfile, setStage, setSurface, toast, updateProfile, useStore } from "../state/store";

const DEFAULT_DPI = 800;
const STAGES = 5;
const rateLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz));

/** Nearest DPI the sensor accepts; moving off `prev` always moves at least one step. */
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
  const isActive = useStore((s) => s.edit === s.active);
  const [sel, setSel] = useState(0);
  const [separate, setSeparate] = useState<Record<number, boolean>>({});

  if (!profile || !info) return <p className="hint">No profile loaded.</p>;
  const st = profile.stages[sel];
  const on = st.x !== 0;
  const sep = separate[sel] ?? st.x !== st.y;
  const dpiMin = info.dpiList[0] ?? 100;
  const dpiMax = info.dpiList[info.dpiList.length - 1] ?? 48000;

  const clickChip = (i: number) => {
    setSel(i);
    if (isActive && profile.stages[i].x && info.stage !== i) void setStage(i);
  };

  const setEnabled = (v: boolean) => {
    if (v) {
      if (on) return;
      const x = snapDpi(info.dpiList, DEFAULT_DPI, 0);
      updateProfile((p) => (p.stages[sel] = { x, y: x, lod: 2 }));
      setSeparate((s) => ({ ...s, [sel]: false }));
    } else {
      if (profile.stages.filter((s) => s.x).length <= 1) return toast("At least one stage must stay enabled", "error");
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

  return (
    <div className="page cols">
      <div className="col">
        <Panel title="DPI STAGES">
          <p className="hint">Click a stage to switch the mouse to it now. New DPI values are felt after you save.</p>
          <div className="stages">
            {profile.stages.map((s, i) => (
              <button key={i} className={`stage-chip ${i === sel ? "on" : ""} ${s.x ? "" : "off"}`} onClick={() => clickChip(i)}>
                <span className="top">
                  {i + 1}
                  {profile.defaultStage === i && <span className="dot" title="Used after power-on">●</span>}
                </span>
                <span className="dpi">{s.x ? s.x : "off"}</span>
                {isActive && info.stage === i && <span className="inuse">IN USE</span>}
              </button>
            ))}
          </div>
          <Row title="Enabled"><Switch checked={on} onChange={setEnabled} label="Enabled" /></Row>
          <Row title="DPI" subtitle={`${dpiMin}–${dpiMax}, snaps to values the sensor accepts`}>
            <NumberField value={on ? st.x : DEFAULT_DPI} min={dpiMin} max={dpiMax} step={50} disabled={!on} onCommit={(v) => setDpi("x", v)} label="DPI" />
          </Row>
          <Row title="Separate X / Y">
            <Switch checked={sep} disabled={!on} label="Separate X / Y" onChange={(v) => {
              setSeparate((s) => ({ ...s, [sel]: v }));
              if (!v) updateProfile((p) => (p.stages[sel].y = p.stages[sel].x));
            }} />
          </Row>
          {sep && on && (
            <Row title="DPI Y">
              <NumberField value={st.y} min={dpiMin} max={dpiMax} step={50} onCommit={(v) => setDpi("y", v)} label="DPI Y" />
            </Row>
          )}
          <Row title="Lift-off distance">
            <select value={Math.min(3, Math.max(1, st.lod))} disabled={!on} onChange={(e) => updateProfile((p) => (p.stages[sel].lod = Number(e.target.value)))}>
              <option value={1}>Low</option>
              <option value={2}>Medium</option>
              <option value={3}>High</option>
            </select>
          </Row>
          <Row title="Default after power-on">
            <Switch checked={profile.defaultStage === sel} disabled={!on} label="Default after power-on" onChange={(v) => {
              if (v) updateProfile((p) => (p.defaultStage = sel));
              else toast("Pick another stage as the default instead", "error");
            }} />
          </Row>
        </Panel>
      </div>
      <div className="col">
        <Panel title="POLLING RATE">
          <Row title="Wireless">
            <Toggles<number> value={profile.rateWireless} onChange={(v) => updateProfile((p) => (p.rateWireless = v))}
              options={RATES_HZ.map((hz, i) => ({ value: i, label: rateLabel(hz), disabled: !info.rates.includes(i) }))} />
          </Row>
          <Row title="Cable">
            <Toggles<number> value={profile.rateWired} onChange={(v) => updateProfile((p) => (p.rateWired = v))}
              options={RATES_HZ.slice(0, 4).map((hz, i) => ({ value: i, label: rateLabel(hz) }))} />
          </Row>
          <p className="hint">Hz. Higher rates feel smoother and use more battery.</p>
        </Panel>
        <Panel title="TRACKING">
          <Row title="Angle snapping" subtitle="Straightens near-horizontal and vertical lines">
            <Switch checked={profile.angleSnap !== 0} label="Angle snapping" onChange={(v) => updateProfile((p) => (p.angleSnap = v ? 1 : 0))} />
          </Row>
          <Row title="Gaming surface mode" subtitle="Applies at once. Device setting, not per profile">
            <select value={Math.max(0, info.surface)} onChange={(e) => void setSurface(Number(e.target.value))} disabled={info.surface < 0}>
              <option value={0}>Auto</option>
              <option value={1}>On</option>
              <option value={2}>Off</option>
            </select>
          </Row>
          <Row title="Scroll filter (ms)" subtitle="Bunny-hop scroll filter, 0 = off">
            <NumberField value={Math.min(profile.scrollFilter, 100) * 10} min={0} max={1000} step={10} label="Scroll filter"
              onCommit={(v) => updateProfile((p) => (p.scrollFilter = Math.round(v / 10)))} />
          </Row>
        </Panel>
        <Panel title="POWER">
          <Row title="Low power after (s)">
            <NumberField value={profile.sleepS} min={1} max={3600} step={5} label="Low power after" onCommit={(v) => updateProfile((p) => (p.sleepS = v))} />
          </Row>
          <Row title="Sleep after (s)">
            <NumberField value={profile.offS} min={10} max={36000} step={30} label="Sleep after" onCommit={(v) => updateProfile((p) => (p.offS = v))} />
          </Row>
        </Panel>
      </div>
    </div>
  );
}
