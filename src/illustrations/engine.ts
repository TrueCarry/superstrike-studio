// Drawing kit for the illustrations: the mouse with press, glow and ripples, the travel gauge,
// callouts, cursor, monitor and the click timing model. Everything draws on the context passed in.
import { ICON_PATHS } from "../components/icons";
import { outline, picture, type View } from "./picture";

export type G = CanvasRenderingContext2D;
export const BG = "#222226", ACCENT = "#3b9cff", ORANGE = "#ff9e33";

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const rgba = (hex: string, a: number) => {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
};
export const dot = (g: G, x: number, y: number, r: number) => (g.beginPath(), g.arc(x, y, r, 0, Math.PI * 2));

export function clear(g: G, w: number, h: number) {
  g.fillStyle = BG;
  g.fillRect(0, 0, w, h);
}

/** Width of the mouse drawn `h` px high. */
export const mouseW = (h: number, view: View = "top") => (picture(view).w * h) / picture(view).h;

/** Which main buttons a click setting is shown on. */
export type Target = "left" | "right" | "both";
export const zonesOf = (t: Target = "left") => (t === "both" ? ["btn-left", "btn-right"] : [t === "right" ? "btn-right" : "btn-left"]);

export interface MouseOpts {
  view?: View;
  /** the button that press, glow and ripples apply to (default the left button) */
  zone?: string;
  /** several buttons pressed together; overrides `zone` */
  zones?: string[];
  press?: number;
  glow?: number;
  /** [age in s, colour] per ripple */
  ripples?: [number, string][];
  /** 0..1 lights the front thumb button (top view) */
  side?: number;
  shell?: string;
}

/** The mouse `h` px high with its top-left at (x, y). Returns where its (first) pressed button sits. */
export function mouse(g: G, x: number, y: number, h: number, o: MouseOpts = {}) {
  const pic = picture(o.view ?? "top"), names = o.zones ?? [o.zone ?? "btn-left"];
  const s = h / pic.h, w = pic.w * s;
  g.save(); // floor shadow
  g.translate(x + w / 2, y + h * 0.98);
  g.scale(w * 0.42, 14);
  dot(g, 0, 0, 1);
  g.restore();
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.fill();
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  outline(g, pic, o.shell);
  g.restore();
  if (o.side) {
    const sx = x + 28 * s, sy = y + 497 * s, rg = g.createRadialGradient(sx, sy, 0, sx, sy, 22);
    rg.addColorStop(0, rgba(ACCENT, 0.9 * o.side));
    rg.addColorStop(1, rgba(ACCENT, 0));
    g.fillStyle = rg;
    g.fillRect(sx - 22, sy - 22, 44, 44);
    g.fillStyle = rgba(ACCENT, o.side);
    g.beginPath();
    g.roundRect(sx - 3, sy - 40 * s, 6, 80 * s, 3);
    g.fill();
  }
  for (const name of names) {
    const zone = pic.zones.get(name)!;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.clip(zone.path);
    g.scale(1 / s, 1 / s);
    g.translate(-x, -y);
    const bx = x + zone.cx * s, by = y + zone.cy * s;
    g.fillStyle = `rgba(0,0,0,${0.18 * (o.press ?? 0)})`;
    g.fillRect(x, y, w, h);
    g.fillStyle = rgba(ACCENT, 0.55 * (o.glow ?? 0));
    g.fillRect(x, y, w, h);
    for (const [age, color] of o.ripples ?? []) {
      const k = age / 0.6;
      if (k < 0 || k >= 1) continue;
      dot(g, bx, by, 6 + w * 0.45 * (1 - (1 - k) * (1 - k)));
      g.fillStyle = rgba(color, 0.3 * (1 - k));
      g.fill();
      g.strokeStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
      g.lineWidth = 3;
      g.stroke();
    }
    g.restore();
  }
  const zone = pic.zones.get(names[0])!;
  return { bx: x + zone.cx * s, by: y + zone.cy * s, top: y + zone.top * s, bottom: y + zone.bottom * s, w };
}

/** The pointer arrow with its tip at (x, y). */
export function cursor(g: G, x: number, y: number, color = "#fff") {
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 19);
  g.lineTo(5, 14.5);
  g.lineTo(8.5, 22);
  g.lineTo(11.5, 20.6);
  g.lineTo(8, 13.3);
  g.lineTo(14, 13.3);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = "#000";
  g.lineWidth = 1.4;
  g.lineJoin = "round";
  g.stroke();
  g.restore();
}

/** The app's icons plus play/pause and a keyboard. */
export const ICONS: Record<string, string> = {
  ...ICON_PATHS,
  media: "M1 3L8 8L1 13Z M9.5 3H12V13H9.5Z M13.5 3H16V13H13.5Z",
  keyboard: "M1 3H15V13H1Z M3 5V7H5V5Z M6 5V7H8V5Z M9 5V7H11V5Z M12 5V7H14V5Z M3 8V10H5V8Z M6 8V10H8V8Z M9 8V10H11V8Z M12 8V10H14V8Z M5 11V12H11V11Z",
};

/** A 16x16 icon at (x, y), `size` px. */
export function icon(g: G, name: string, x: number, y: number, size: number, color: string) {
  const k = size / 16;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.fillStyle = color;
  g.fill(new Path2D(ICONS[name] ?? ICONS.buttons));
  g.restore();
}

/** An icon in a callout box centred on (cx, cy). */
export function bubble(g: G, cx: number, cy: number, size: number, name: string, color = ACCENT) {
  g.fillStyle = "rgb(31,31,36)";
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22);
  g.fill();
  g.stroke();
  icon(g, name, cx - size / 4, cy - size / 4, size / 2, "#fff");
}

/** A callout line from a point on the mouse to a bubble at (bx, by), popping in over `pop` 0..1. */
export function callout(g: G, zx: number, zy: number, bx: number, by: number, size: number, name: string, pop: number, color = ACCENT) {
  if (pop <= 0) return;
  const e = ease(Math.min(1, pop)), sz = size * e, ex = bx + ((zx < bx ? -1 : 1) * sz) / 2;
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(zx, zy);
  g.lineTo(zx + (ex - zx) * e, zy + (by - zy) * e);
  g.stroke();
  g.fillStyle = color;
  dot(g, zx, zy, 5);
  g.fill();
  if (sz > 4) bubble(g, bx, by, sz, name, color);
}

/** A monitor with its screen at (x, y, w, h). */
export function monitor(g: G, x: number, y: number, w: number, h: number) {
  g.fillStyle = "#3a3a40";
  g.beginPath();
  g.roundRect(x - 8, y - 8, w + 16, h + 16, 12);
  g.fill();
  g.fillStyle = "#2b2f38";
  g.beginPath();
  g.roundRect(x, y, w, h, 6);
  g.fill();
}

/** Button travel 0 (up) .. 1 (bottomed out) as the app's travel bar, upright; `at` the click point, `band` the rapid trigger lift. */
export function gauge(g: G, x: number, top: number, bottom: number, o: { depth: number; at: number; clicked: boolean; band?: [number, number] | null }) {
  const SEGS = 10, sh = (bottom - top) / SEGS, w = 14;
  for (let i = 0; i < SEGS; i++) {
    const y = top + i * sh, through = o.depth * SEGS > i + 0.02;
    g.fillStyle = through ? (o.clicked ? ACCENT : "rgba(255,255,255,0.6)") : "rgba(255,255,255,0.1)";
    g.beginPath();
    g.roundRect(x, y + 1.5, w, sh - 3, 3);
    g.fill();
  }
  const ay = top + o.at * (bottom - top);
  g.fillStyle = ACCENT;
  g.beginPath();
  g.roundRect(x - 4, ay - 2, w + 8, 4, 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(x - 13, ay - 6);
  g.lineTo(x - 13, ay + 6);
  g.lineTo(x - 6, ay);
  g.fill();
  if (o.band) {
    const [y0, y1] = o.band.map((d) => top + d * (bottom - top));
    g.fillStyle = rgba(ORANGE, 0.85);
    g.beginPath();
    g.roundRect(x + w + 5, y0, 6, Math.max(6, y1 - y0), 3);
    g.fill();
  }
}

/** Level pills (haptics 0..5 and the like), the current one lit and the lower ones dimmed. */
export function pills(g: G, x: number, y: number, w: number, h: number, n: number, level: number, color = ACCENT) {
  const gap = 6, pw = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i === level ? color : i < level ? rgba(color, 0.35) : "rgba(255,255,255,0.1)";
    g.beginPath();
    g.roundRect(x + i * (pw + gap), y, pw, h, h / 2);
    g.fill();
  }
}

/** Dots that fill as clicks count, each popping in. */
export function counter(g: G, cx: number, y: number, n: number, times: number[], color: string, t: number) {
  const x0 = cx - ((n - 1) * 22) / 2;
  for (let i = 0; i < n; i++) {
    const on = i < times.length, pop = on ? clamp((t - times[i]) / 0.18) : 1;
    g.fillStyle = on ? color : "rgba(255,255,255,0.12)";
    dot(g, x0 + i * 22, y, on ? 6.5 * (1 + 0.5 * Math.sin(pop * Math.PI)) : 6.5);
    g.fill();
  }
}

/** Click times up to t for travel depth(s): fires at `A`; with rapid trigger it also re-arms after lifting `rt`. */
export function clicks(depth: (s: number) => number, t: number, A: number, rt = 0) {
  const times: number[] = [];
  let pressed = false, lo = 0, hi = 0;
  for (let s = 0; s <= t + 1e-9; s += 0.002) {
    const d = depth(s);
    if (!pressed) {
      lo = Math.min(lo, d);
      if (d >= A && (!rt || d >= lo + rt)) (pressed = true), (hi = d), times.push(s);
    } else {
      hi = Math.max(hi, d);
      if (d < A || (rt && d <= hi - rt)) (pressed = false), (lo = d);
    }
  }
  return { times, pressed, hi };
}
export const glowOf = (c: { times: number[]; pressed: boolean }, t: number) =>
  c.pressed ? 1 : c.times.length ? clamp(1 - (t - c.times.at(-1)!) / 0.15) : 0;
