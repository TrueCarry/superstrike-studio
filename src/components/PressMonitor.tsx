// Live press, from the HITS monitoring streams (state/monitor.ts): bars on the Actuation card showing how far
// each button is pressed against its click point, and charts with the raw streams on the Device panel.
import { useEffect, useState } from "react";
import { t, tc } from "../i18n/i18n";
import { getHistory, getMonitor, HISTORY_MS, useLiveMonitor, useMonitor, type Sample, type Stream } from "../state/monitor";
import { useStore } from "../state/store";
import { FxCard } from "./cards";
import { useMouseInput } from "./useMouseInput";

const NAMES: Record<number, string> = { 0: "coarse travel", 1: "travel", 2: "top (released)", 3: "bottom (actuation 10)" };
const SIDES = [0, 1] as const;
const sideName = (b: number) => tc("HITS target", b ? "Right" : "Left");

/**
 * The click point for actuation 1–10, as the share of the way from top to bottom. Measured, not documented:
 * the median of ~270 slow clicks on a PRO X3, left and right alike (fast presses read early, as the travel stream
 * lags the click by a report or two).
 */
const CLICK_AT = [0.048, 0.098, 0.163, 0.22, 0.306, 0.407, 0.52, 0.651, 0.802, 0.982];
const clickPoint = (top: number, bottom: number, act: number) =>
  top + (bottom - top) * CLICK_AT[Math.min(10, Math.max(1, Math.round(act))) - 1];

/**
 * The range bars and charts show, the same for both buttons: just past the lower top level (stream 2) and the
 * higher bottom level (stream 3), rounded out to tens so the small drift of the levels doesn't move it.
 */
const MARGIN = 20;
function useRange(): [number, number] {
  const lo = useMonitor((m) => {
    const top = m.streams[2]?.words;
    return top ? Math.max(0, Math.floor((Math.min(top[0], top[1]) - MARGIN) / 10) * 10) : 0;
  });
  const hi = useMonitor((m) => {
    const bottom = m.streams[3]?.words;
    return bottom ? Math.ceil((Math.max(bottom[0], bottom[1]) + MARGIN) / 10) * 10 : 1024;
  });
  return hi > lo ? [lo, hi] : [0, 1024];
}

/** The actuation each button uses now (the active profile's; its unsaved HITS are already live). */
function useActs(): [number | undefined, number | undefined] {
  // two plain numbers: a selector returning a new array each time would re-render forever
  const l = useStore((s) => s.profiles[s.active]?.hits[0].act);
  const r = useStore((s) => s.profiles[s.active]?.hits[1].act);
  return [l, r];
}

function LiveError() {
  const error = useMonitor((m) => m.error);
  return error ? <span className="ss-badge warn wrap">{error}</span> : null;
}

// ---------------------------------------------------------------- Actuation card

/** Live bars for the Actuation card: how far each button is down, its click point and where the last click fired. */
export function LivePressBars() {
  useLiveMonitor();
  const demo = useStore((s) => !!s.info?.demo);
  const on = useMonitor((m) => m.state === "on");
  const error = useMonitor((m) => !!m.error);
  if (demo || (!on && !error)) return null;
  return (
    <div className="live-press">
      <LiveError />
      {on && <Bars />}
    </div>
  );
}

function Bars() {
  const travel = useMonitor((m) => m.streams[1]?.words);
  const top = useMonitor((m) => m.streams[2]?.words);
  const bottom = useMonitor((m) => m.streams[3]?.words);
  const range = useRange();
  const acts = useActs();
  const last = useLastClicks();
  const { pressed } = useMouseInput();
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - range[0]) / (range[1] - range[0])) * 100))}%`;
  return (
    <>
      {SIDES.map((b) => {
        const act = acts[b];
        const click = top && bottom && act !== undefined ? clickPoint(top[b], bottom[b], act) : undefined;
        return (
          <div key={b} className={`press-bar ${pressed.has(b ? "btn-right" : "btn-left") ? "down" : ""}`}>
            <span className="press-label">{sideName(b)}</span>
            <div className="press-track" role="meter" aria-label={sideName(b)} aria-valuemin={range[0]} aria-valuemax={range[1]} aria-valuenow={travel?.[b]}>
              {travel && <div className="press-fill" style={{ width: at(travel[b]) }} />}
              {click !== undefined && <div className="press-click" style={{ insetInlineStart: at(click) }} />}
              {last[b] !== undefined && <div className="press-last" style={{ insetInlineStart: at(last[b]) }} />}
            </div>
          </div>
        );
      })}
      <div className="press-legend">
        <span className="key fill">{t("Pressed")}</span>
        <span className="key click">{t("Click point")}</span>
        <span className="key last">{t("Last click")}</span>
      </div>
    </>
  );
}

/** Raw travel of the left and right button at the moment of their last click in the page. */
function useLastClicks(): [number | undefined, number | undefined] {
  const [last, setLast] = useState<[number | undefined, number | undefined]>([undefined, undefined]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      const travel = getMonitor().streams[1]?.words[e.button / 2];
      if (travel !== undefined) setLast((l) => (e.button ? [l[0], travel] : [travel, l[1]]));
    };
    window.addEventListener("pointerdown", down);
    return () => window.removeEventListener("pointerdown", down);
  }, []);
  return last;
}

// ---------------------------------------------------------------- Device panel

/** Device panel card: the streams over the last seconds, and their raw data. */
export function LivePressCard() {
  useLiveMonitor();
  const demo = useStore((s) => !!s.info?.demo);
  const on = useMonitor((m) => m.state === "on");
  if (demo) return null;
  return (
    <FxCard title={t("Live press")} icon="actuation" className="press-monitor">
      <LiveError />
      {on && <Charts />}
    </FxCard>
  );
}

function Charts() {
  const streams = useMonitor((m) => m.streams);
  const range = useRange();
  const acts = useActs();
  const ids = Object.keys(streams).map(Number).sort((a, b) => a - b);
  return (
    <>
      <div className="press-legend">
        <span className="key travel">travel (1)</span>
        <span className="key top">top (2)</span>
        <span className="key bottom">bottom (3)</span>
        <span className="key click">{t("Click point")}</span>
        <span className="key down">{t("Pressed")}</span>
      </div>
      {SIDES.map((b) => <PressChart key={b} b={b} act={acts[b]} range={range} />)}
      <table className="streams">
        <thead>
          <tr><th>Stream</th><th>Hz</th><th>Count</th><th>Values</th><th>Raw payload</th></tr>
        </thead>
        <tbody>
          {ids.map((id) => <StreamRow key={id} id={id} s={streams[id]} />)}
        </tbody>
      </table>
    </>
  );
}

function StreamRow(props: { id: number; s: Stream }) {
  const { id, s } = props;
  return (
    <tr>
      <td>{id} <small>{NAMES[id] ?? "unknown"}</small></td>
      <td>{s.rate}</td>
      <td>{s.count}</td>
      <td className="mono">{s.words.slice(0, 2).join(" ")}</td>
      <td className="mono raw">{s.raw}</td>
    </tr>
  );
}

/** Grid lines every 100 inside the range, not too close to its edges. */
const grid = (lo: number, hi: number) =>
  Array.from({ length: Math.floor(hi / 100) - Math.ceil(lo / 100) + 1 }, (_, i) => (Math.ceil(lo / 100) + i) * 100).filter((v) => v - lo > 15 && hi - v > 15);

const W = 600; // chart width in SVG units (it stretches to the card)

/** The last few seconds of one button: travel, top (stream 2), bottom (stream 3), click point, pressed. */
function PressChart(props: { b: 0 | 1; act?: number; range: [number, number] }) {
  useMonitor((m) => m.streams); // redraw with every screen update of the monitor
  const { b, act } = props;
  const [lo, hi] = props.range;
  const H = hi - lo;
  const hist = getHistory();
  if (hist.length < 2) return null;
  const end = hist[hist.length - 1].t;
  const x = (t: number) => W - ((end - t) / HISTORY_MS) * W;
  const y = (v: number) => hi - Math.min(hi, Math.max(lo, v)); // readings beyond the range stay on its edge
  const line = (v: (s: Sample) => number) => hist.map((s, i) => `${i ? "L" : "M"}${x(s.t).toFixed(1)} ${y(v(s)).toFixed(1)}`).join("");
  const down: [number, number][] = []; // pressed spans
  hist.forEach((s, i) => {
    if (!s.down[b]) return;
    const x1 = x(hist[i + 1]?.t ?? s.t);
    if (hist[i - 1]?.down[b]) down[down.length - 1][1] = x1;
    else down.push([x(s.t), x1]);
  });
  return (
    <figure className="press-chart">
      <figcaption>{sideName(b)}</figcaption>
      <div className="press-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={sideName(b)}>
          {down.map(([a, z], i) => <rect key={i} className="down" x={a} y={0} width={Math.max(1, z - a)} height={H} />)}
          {grid(lo, hi).map((v) => <line key={v} className="grid" x1={0} x2={W} y1={y(v)} y2={y(v)} />)}
          <path className="top" d={line((s) => s.top[b])} />
          <path className="bottom" d={line((s) => s.bottom[b])} />
          {act !== undefined && <path className="click" d={line((s) => clickPoint(s.top[b], s.bottom[b], act))} />}
          <path className="travel" d={line((s) => s.travel[b])} />
        </svg>
        <span className="press-axis" style={{ top: 0 }}>{hi}</span>
        {grid(lo, hi).filter((v) => v - lo > 40 && hi - v > 40).map((v) =>
          <span key={v} className="press-axis mid" style={{ top: `${((hi - v) / H) * 100}%` }}>{v}</span>)}
        <span className="press-axis" style={{ bottom: 0 }}>{lo}</span>
      </div>
    </figure>
  );
}
