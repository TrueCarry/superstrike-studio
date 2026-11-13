// SVG mouse picture with clickable zones, callouts, a flip between top and side view, and live
// press / scroll animation. Drawings from upstream assets/ (MIT).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import sideSvg from "../mouse_side.svg?raw";
import topSvg from "../mouse_top.svg?raw";
import type { Zone } from "../model/tables";
import { useStore } from "../state/store";

export type View = "top" | "side";

// The drawings' own <style> would apply to the whole page; drop it and style them in CSS instead.
// Zone ids become data-zone so two pictures never clash on ids.
function prepare(svg: string) {
  const inner = svg
    .replace(/<\?xml[^>]*>/, "")
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replace(/id="(btn-[a-z]+)"/g, 'data-zone="$1"')
    .replace(/ id="[^"]+"/g, "");
  const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(inner) ?? [, "510", "993"];
  return { svg: inner.replace(/<svg[^>]*>/, (tag) => tag.replace(/ width="[^"]*"| height="[^"]*"/g, "")), w: +w!, h: +h! };
}
const PICTURES = { top: prepare(topSvg), side: prepare(sideSvg) };
export const ZONES: Record<View, Zone[]> = { top: ["btn-left", "btn-right", "btn-middle"], side: ["btn-forward", "btn-back", "btn-middle"] };
const MARGIN = 500; // room for callouts on both sides, in drawing units
const BOX_W = 440; // boxed callout width
const LINE_H = 58; // callout line height
const FLIP_MS = 220;

interface Callout {
  zone: Zone;
  cx: number;
  cy: number;
  side: "left" | "right";
  y: number;
}

export function MouseView(props: {
  view: View;
  selected?: string;
  onZone?: (zone: Zone) => void;
  labelFor?: (zone: Zone) => string; // "Title\nline 2\nline 3"
  pressed?: ReadonlySet<string>;
  wheelTick?: number; // changes on every scroll step
  boxes?: boolean; // G HUB style boxed callouts (HITS page)
}) {
  const shell = useStore((s) => s.shell);
  const accent = useStore((s) => s.accent);
  const [shown, setShown] = useState(props.view);
  const [flipping, setFlipping] = useState(false);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [wheel, setWheel] = useState(false);
  const host = useRef<SVGGElement>(null);
  const pic = PICTURES[shown];

  // Turn edge-on, swap the drawing, turn back (the CSS transition animates both halves).
  useEffect(() => {
    if (props.view === shown) return;
    setFlipping(true);
    const t = setTimeout(() => {
      setShown(props.view);
      setFlipping(false);
    }, FLIP_MS);
    return () => clearTimeout(t);
  }, [props.view, shown]);

  useEffect(() => {
    if (!props.wheelTick) return;
    setWheel(true);
    const t = setTimeout(() => setWheel(false), 160);
    return () => clearTimeout(t);
  }, [props.wheelTick]);

  // Zone classes and clicks.
  useLayoutEffect(() => {
    const g = host.current;
    if (!g) return;
    const cleanups: (() => void)[] = [];
    for (const el of g.querySelectorAll<SVGGraphicsElement>("[data-zone]")) {
      const z = el.dataset.zone as Zone;
      el.classList.toggle("selected", props.selected === z);
      el.classList.toggle("pressed", !!props.pressed?.has(z));
      el.classList.toggle("clickable", !!props.onZone);
      if (props.onZone) {
        const click = () => props.onZone?.(z);
        el.addEventListener("click", click);
        cleanups.push(() => el.removeEventListener("click", click));
      }
    }
    g.querySelector(".wheel")?.classList.toggle("rolling", wheel);
    return () => cleanups.forEach((c) => c());
  });

  // Callout anchors from the zone shapes, spread so boxes do not overlap.
  useLayoutEffect(() => {
    const g = host.current;
    if (!g || !props.labelFor) return setCallouts([]);
    const list: Callout[] = [];
    for (const z of ZONES[shown]) {
      const el = g.querySelector<SVGGraphicsElement>(`[data-zone="${z}"]`);
      if (!el || !props.labelFor(z)) continue;
      const b = el.getBBox();
      const cx = b.x + b.width / 2;
      const cy = b.y + Math.min(b.height / 2, 160);
      const side = z === "btn-middle" ? (shown === "top" ? "right" : "left") : cx < pic.w / 2 ? "left" : "right";
      list.push({ zone: z, cx, cy, side, y: cy });
    }
    for (const side of ["left", "right"] as const) {
      const col = list.filter((c) => c.side === side).sort((a, b) => a.y - b.y);
      for (let i = 1; i < col.length; i++) col[i].y = Math.max(col[i].y, col[i - 1].y + 4 * LINE_H + 40);
    }
    setCallouts(list);
  }, [shown, pic.w, props.labelFor]);

  const viewBox = `${-MARGIN} -20 ${pic.w + 2 * MARGIN} ${pic.h + 40}`;
  const style = useMemo(() => ({ "--shell": shell, "--accent": accent }) as React.CSSProperties, [shell, accent]);

  return (
    <div className={`mouseview ${flipping ? "flipping" : ""}`} style={style}>
      <svg viewBox={viewBox} role="img" aria-label={`Mouse, ${shown} view`}>
        <g ref={host} key={shown} dangerouslySetInnerHTML={{ __html: pic.svg.replace("<svg", `<svg width="${pic.w}" height="${pic.h}"`) }} />
        {callouts.map((c) => {
          const lines = props.labelFor?.(c.zone).split("\n") ?? [];
          const x = c.side === "left" ? -40 : pic.w + 40;
          const left = c.side === "left";
          // Boxed: text left-aligned inside the box. Plain: text right-aligned on the left side.
          const textX = props.boxes ? (left ? x - BOX_W + 28 : x + 28) : left ? x - 14 : x + 14;
          const anchor = props.boxes || !left ? "start" : "end";
          return (
            <g key={c.zone} className={`callout ${props.selected === c.zone ? "selected" : ""}`} onClick={() => props.onZone?.(c.zone)}>
              <polyline points={`${c.cx},${c.cy} ${left ? x + 10 : x - 10},${c.y} ${x},${c.y}`} />
              {props.boxes && <rect x={left ? x - BOX_W : x} y={c.y - 50} width={BOX_W} height={lines.length * LINE_H + 34} rx={24} />}
              <text x={textX} y={c.y + 6} textAnchor={anchor}>
                {lines.map((l, i) => (
                  <tspan key={i} x={textX} dy={i ? LINE_H : 0} className={i ? "sub" : "title"}>
                    {l}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
