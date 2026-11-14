// Mouse picture, a port of upstream mouseview.cpp + mouseview_fx.cpp (MIT): the SVG drawing with
// tinted clickable zones, G HUB style grid and check badge, Lines or Boxes callouts, floor shadow,
// a thumbnail of the other side (click it, or drag sideways, to rotate), and live input: press
// glow and ripple, rolling wheel ribs with a direction arrow.
import { useEffect, useLayoutEffect, useRef } from "react";
import { tc } from "../i18n/i18n";
import { picture as pictureOf, type Picture, type View, type ZoneGeo } from "../illustrations/picture";
import type { Zone } from "../model/tables";
import { useStore } from "../state/store";
import { font, roundRect, text } from "./controls";
import { ICON_PATHS } from "./icons";
import { useMouseInput } from "./useMouseInput";

export type { View };
export type Callouts = "none" | "lines" | "boxes";
const VIEWS: View[] = ["top", "side"];
export const ZONES: Record<View, Zone[]> = { top: ["btn-left", "btn-right", "btn-middle"], side: ["btn-forward", "btn-back", "btn-middle"] };
const FLIP_MS = 450;

const picture = (v: number) => pictureOf(VIEWS[v]);

// ---------------------------------------------------------------- helpers

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type G = CanvasRenderingContext2D;
const dot = (g: G, x: number, y: number, r: number) => (g.beginPath(), g.arc(x, y, r, 0, Math.PI * 2));
const rgba = (hex: string, a = 1) => {
  const v = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
};
/** Pango-like line height of a font size in points. */
const lineH = (pt: number) => Math.ceil(((pt * 4) / 3) * 1.22);

/** Runs `f` clipped to a zone placed in rect r. */
function masked(g: G, pic: Picture, z: ZoneGeo, r: Rect, f: () => void) {
  g.save();
  const base = g.getTransform();
  g.translate(r.x, r.y);
  g.scale(r.w / pic.w, r.h / pic.h);
  g.clip(z.path);
  g.setTransform(base);
  f();
  g.restore();
}

interface Placed {
  name: string;
  geo: ZoneGeo;
  cx: number; // widget pixels
  cy: number;
  top: number;
}
const place = (pic: Picture, r: Rect): Placed[] =>
  [...pic.zones].map(([name, geo]) => ({
    name, geo,
    cx: r.x + (geo.cx * r.w) / pic.w,
    cy: r.y + (geo.cy * r.h) / pic.h,
    top: r.y + (geo.top * r.h) / pic.h,
  }));

interface Anchor {
  x: number;
  y: number;
  left: boolean;
  sel: boolean;
  hot: boolean;
  text: string;
}

// ---------------------------------------------------------------- renderer

export interface MouseViewProps {
  view: View;
  onView?: (v: View) => void;
  /** clickable zones; empty or unset = all of the view */
  zones?: Zone[];
  callouts?: Callouts;
  thumbnail?: boolean;
  grid?: boolean;
  /** drag sideways / thumbnail rotates the view */
  flip?: boolean;
  selected?: string;
  /** "Title\nline 2"; Boxes rows may start with \x01 actuation, \x02 rapid trigger, \x03 haptics */
  labelFor?: (zone: Zone) => string;
  onZone?: (zone: Zone) => void;
  /** a click on the shell outside the button zones (the sensor sits under it) */
  onBody?: () => void;
}

class Renderer {
  g: G;
  W = 0;
  H = 0;
  props: MouseViewProps = { view: "top" };
  shell = "#ffffff";
  accent = "#3b9cff";
  cur = 0;
  anim: { t0: number; from: number; to: number; p: number } | null = null;
  hover = "";
  thumbHover = false;
  press = new Map<string, number>();
  held = new Map<string, boolean>();
  ripples: [string, number][] = [];
  phase = 0;
  vel = 0;
  last = 0;
  raf = 0;
  dragX: number | null = null;
  dragY = 0;
  dragDx = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.g = canvas.getContext("2d")!;
  }

  get callouts(): Callouts {
    return this.props.callouts ?? "lines";
  }
  get thumbnail() {
    return this.props.thumbnail ?? true;
  }
  get flip() {
    return this.props.flip ?? true;
  }
  /** Clickable zones; none when nothing listens for a click (the picture is then for looking only). */
  active(v: number): string[] {
    if (!this.props.onZone) return [];
    const z = this.props.zones;
    return ZONES[VIEWS[v]].filter((n) => !z?.length || z.includes(n as Zone));
  }
  target() {
    return this.anim ? this.anim.to : this.cur;
  }

  // ---- layout
  thumbRect(v: number): Rect {
    const p = picture(v);
    const th = Math.round(Math.min(this.H * 0.24, 170)), tw = Math.round((th * p.w) / p.h);
    return { x: Math.round(this.W - tw - 16), y: Math.round(this.H - th - 38), w: tw, h: th };
  }
  /** The same size and place on every tab: room for the widest callouts and the thumbnail is always kept. */
  fit(v: number): Rect {
    const p = picture(v), W = this.W, H = this.H;
    const room = Math.max(Math.min(260, W * 0.3), this.thumbRect(1 - v).w + 22);
    const s = Math.min(Math.max(50, W - 2 * room) / p.w, Math.max(50, Math.min(H - 30, 720)) / p.h);
    const w = Math.round(p.w * s), h = Math.round(p.h * s);
    return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
  }
  inThumb(x: number, y: number) {
    if (!this.thumbnail || !this.flip || this.anim) return false;
    const t = this.thumbRect(1 - this.cur);
    return x >= t.x - 8 && x <= t.x + t.w + 8 && y >= t.y - 8 && y <= t.y + t.h + 30;
  }
  zoneAt(px: number, py: number): string {
    if (this.anim) return "";
    const pic = picture(this.cur), r = this.fit(this.cur);
    const x = ((px - r.x) * pic.w) / r.w, y = ((py - r.y) * pic.h) / r.h;
    const g = this.g;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const act = this.active(this.cur);
    let hit = "";
    for (let i = act.length - 1; i >= 0 && !hit; i--) {
      const z = pic.zones.get(act[i]);
      if (z && g.isPointInPath(z.path, x, y)) hit = act[i];
    }
    g.restore();
    return hit;
  }
  bodyAt(px: number, py: number): boolean {
    if (this.anim || !this.props.onBody) return false;
    const pic = picture(this.cur), r = this.fit(this.cur), body = pic.parts.find((p) => p.kind === "body");
    const g = this.g;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const hit = !!body && g.isPointInPath(body.path, ((px - r.x) * pic.w) / r.w, ((py - r.y) * pic.h) / r.h);
    g.restore();
    return hit;
  }

  // ---- drawing
  resize(w: number, h: number) {
    const dpr = window.devicePixelRatio || 1;
    this.W = w;
    this.H = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.draw();
  }

  drawPicture(v: number, r: Rect, hov: string, sel: string) {
    const g = this.g, pic = picture(v), act = this.active(v);
    g.save();
    g.translate(r.x, r.y);
    g.scale(r.w / pic.w, r.h / pic.h);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const p of pic.parts) {
      if (p.kind === "body") (g.fillStyle = this.shell), g.fill(p.path);
      else if (p.kind === "wheel") (g.fillStyle = "#6e6e75"), g.fill(p.path);
      else if (p.kind === "brand") (g.fillStyle = "#9c9ca3"), g.fill(p.path);
      else if (p.kind === "line") (g.strokeStyle = "#16161a"), (g.lineWidth = p.width), g.stroke(p.path);
      else if (act.includes(p.id)) {
        const op = p.id === sel ? 0.62 : p.id === hov ? 0.38 : 0.16;
        g.fillStyle = rgba(this.accent, op);
        g.fill(p.path);
        if (p.id === sel) (g.strokeStyle = this.accent), (g.lineWidth = 6), g.stroke(p.path);
      }
    }
    g.restore();
  }

  draw() {
    const g = this.g, W = this.W, H = this.H;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    let v = this.cur, sx = 1;
    if (this.anim) (v = this.anim.p < 0.5 ? this.anim.from : this.anim.to), (sx = Math.max(0.02, Math.abs(Math.cos(Math.PI * this.anim.p))));
    const r = this.fit(v);
    const placed = `${r.x},${r.y},${r.w},${r.h}`;
    if (!this.anim && this.canvas.dataset.fit !== placed) this.canvas.dataset.fit = placed; // read by tools/parity/layout.mjs
    g.save(); // floor shadow
    g.translate(W / 2, r.y + r.h * 0.98);
    g.scale(r.w * 0.42 * sx, 14);
    dot(g, 0, 0, 1);
    g.restore();
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fill();
    g.save();
    g.translate(W / 2, 0);
    g.scale(sx, 1);
    g.translate(-W / 2, 0);
    this.drawPicture(v, r, this.hover, this.props.selected ?? "");
    g.restore();
    if (this.anim) return;
    const pic = picture(v), zm = place(pic, r), act = this.active(v);
    if (this.props.grid) for (const m of zm) if (act.includes(m.name)) this.drawGrid(pic, m, r, m.name === this.props.selected);
    if (this.busy()) this.drawInput(pic, zm, r, v === 0);
    if (this.callouts !== "none" && this.props.labelFor) this.drawCallouts(v, zm, r);
    if (this.thumbnail) this.drawThumb(1 - v);
  }

  drawGrid(pic: Picture, m: Placed, r: Rect, sel: boolean) {
    const g = this.g, step = Math.max(6, r.w * 0.045);
    masked(g, pic, m.geo, r, () => {
      g.strokeStyle = rgba(this.accent, sel ? 0.95 : 0.55);
      g.lineWidth = 1;
      g.beginPath();
      for (let x = r.x; x < r.x + r.w; x += step) g.moveTo(Math.floor(x) + 0.5, r.y), g.lineTo(Math.floor(x) + 0.5, r.y + r.h);
      for (let y = r.y; y < r.y + r.h; y += step) g.moveTo(r.x, Math.floor(y) + 0.5), g.lineTo(r.x + r.w, Math.floor(y) + 0.5);
      g.stroke();
    });
    if (!sel || !m.geo.ok) return;
    const rad = Math.max(9, r.w * 0.05), bx = m.cx, by = m.cy + rad * 2.4; // below the callout dot
    g.fillStyle = this.accent;
    dot(g, bx, by, rad);
    g.fill();
    g.strokeStyle = "#fff";
    g.lineWidth = Math.max(2, rad * 0.22);
    g.lineCap = "butt";
    g.lineJoin = "miter";
    g.beginPath();
    g.moveTo(bx - rad * 0.45, by);
    g.lineTo(bx - rad * 0.1, by + rad * 0.35);
    g.lineTo(bx + rad * 0.45, by - rad * 0.35);
    g.stroke();
  }

  busy() {
    for (const l of this.press.values()) if (l > 0.01) return true;
    return this.ripples.length > 0;
  }

  drawInput(pic: Picture, zm: Placed[], r: Rect, top: boolean) {
    const g = this.g, now = performance.now();
    for (const m of zm) { // press shade + glow
      const l = this.press.get(m.name) ?? 0;
      if (m.name === "wheel" || l <= 0.01) continue;
      masked(g, pic, m.geo, r, () => {
        g.fillStyle = `rgba(0,0,0,${0.18 * l})`;
        g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle = rgba(this.accent, 0.55 * l);
        g.fillRect(r.x, r.y, r.w, r.h);
      });
    }
    for (const [z, t0] of this.ripples) { // ripple masked by the zone
      const m = zm.find((p) => p.name === z && p.geo.ok);
      const age = (now - t0) / 600;
      if (!m || age < 0 || age >= 1) continue;
      masked(g, pic, m.geo, r, () => {
        dot(g, m.cx, m.cy, 6 + r.w * 0.45 * (1 - (1 - age) * (1 - age)));
        g.fillStyle = rgba(this.accent, 0.3 * (1 - age));
        g.fill();
        g.strokeStyle = `rgba(255,255,255,${0.75 * (1 - age)})`;
        g.lineWidth = 3;
        g.stroke();
      });
    }
    const wl = this.press.get("wheel") ?? 0;
    const wm = zm.find((p) => p.name === "wheel" && p.geo.ok) ?? zm.find((p) => p.name === "btn-middle" && p.geo.ok);
    if (wl <= 0.01 || !wm) return;
    const half = Math.max(8, (wm.cy - wm.top) * 1.2);
    const gap = Math.max(3, r.h * (top ? 0.011 : 0.016));
    const off = (((this.phase * gap) % gap) + gap) % gap;
    masked(g, pic, wm.geo, r, () => {
      g.fillStyle = rgba(this.accent, 0.45 * wl);
      g.fillRect(0, 0, this.W, this.H);
      g.strokeStyle = `rgba(255,255,255,${0.9 * wl})`;
      g.lineWidth = Math.max(1.2, gap * 0.35);
      g.beginPath();
      for (let y = wm.cy - half - gap + off; y < wm.cy + half + gap; y += gap) g.moveTo(wm.cx - r.w * 0.2, y), g.lineTo(wm.cx + r.w * 0.2, y);
      g.stroke();
    });
    const d = this.vel > 0 ? 1 : -1, s = Math.max(6, r.w * 0.035); // direction arrow beside the wheel
    const ax = wm.cx + r.w * (top ? 0.16 : 0.3), ay = wm.cy + d * half * 0.2;
    g.fillStyle = rgba(this.accent, wl);
    g.beginPath();
    g.moveTo(ax - s, ay - d * s * 0.6);
    g.lineTo(ax + s, ay - d * s * 0.6);
    g.lineTo(ax, ay + d * s * 0.8);
    g.closePath();
    g.fill();
  }

  drawCallouts(v: number, zm: Placed[], r: Rect) {
    const items: Anchor[] = [];
    for (const z of this.active(v)) {
      const m = zm.find((p) => p.name === z && p.geo.ok);
      if (!m) continue;
      const y = v === 0 && z === "btn-middle" ? m.top + (m.cy - m.top) * 0.6 : m.cy;
      const left = v === 1 || (z !== "btn-middle" && m.cx < r.x + r.w / 2 - 2);
      items.push({ x: m.cx, y, left, sel: z === this.props.selected, hot: z === this.hover, text: this.props.labelFor!(z as Zone) });
    }
    items.sort((a, b) => a.y - b.y);
    if (this.callouts === "lines") this.lines(items, r);
    else this.boxes(items, r);
  }

  lines(items: Anchor[], r: Rect) {
    const g = this.g, placed: number[][] = [[], []];
    for (const it of items) {
      if (!it.text) continue;
      const [title, ...detail] = it.text.split("\n");
      let ly = it.y;
      const pl = placed[it.left ? 0 : 1];
      for (const py of pl) if (Math.abs(ly - py) < 54) ly = py + 54;
      pl.push(ly);
      const hi = it.sel || it.hot;
      const lx = it.left ? r.x - 30 : r.x + r.w + 30;
      g.strokeStyle = g.fillStyle = rgba(this.accent, hi ? 1 : 0.75);
      g.lineWidth = hi ? 2 : 1.3;
      g.lineCap = "butt";
      g.beginPath();
      g.moveTo(it.x, it.y);
      g.lineTo(lx + (it.left ? 14 : -14), ly);
      g.lineTo(lx, ly);
      g.stroke();
      dot(g, it.x, it.y, hi ? 4.5 : 3.5);
      g.fill();
      const al = it.left ? 1 : 0, tx = it.left ? lx - 8 : lx + 8;
      g.fillStyle = "rgb(237,237,242)";
      text(g, title, font(10.5, true), tx, ly - lineH(10.5), al);
      g.fillStyle = this.accent;
      detail.forEach((d, i) => text(g, d, font(9.5), tx, ly + 1 + i * lineH(9.5), al));
    }
  }

  boxes(items: Anchor[], r: Rect) {
    const PAD = 12, ROW = 22, VPAD = 8, GLY = 22, fnt = font(11, true);
    const g = this.g, bottom = [-1e9, -1e9];
    const glyphOf = (row: string) => (row.charCodeAt(0) >= 1 && row.charCodeAt(0) <= 3 ? row.charCodeAt(0) : 0);
    for (const it of items) {
      if (!it.text) continue;
      const rows = it.text.split("\n");
      let tw = 0;
      for (const row of rows) tw = Math.max(tw, (glyphOf(row) ? GLY : 0) + text(g, glyphOf(row) ? row.slice(1).trimStart() : row, fnt, 0, 0, 0, false));
      const bw = Math.max(88, tw + 2 * PAD), bh = rows.length * ROW + 2 * VPAD;
      const bx = it.left ? Math.max(6, r.x - 10 - bw) : Math.min(this.W - 6 - bw, r.x + r.w + 10);
      const side = it.left ? 0 : 1;
      let by = Math.max(Math.min(it.y - bh / 2, this.H - 8 - bh), 8);
      by = Math.max(by, bottom[side] + 8);
      bottom[side] = by + bh;
      // leader line from the box edge to a dot on the zone
      const ex = it.left ? bx + bw : bx;
      g.strokeStyle = g.fillStyle = rgba(this.accent, it.sel || it.hot ? 1 : 0.7);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(ex, by + bh / 2);
      g.lineTo(it.x, it.y);
      g.stroke();
      dot(g, it.x, it.y, 4);
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.45)";
      g.lineWidth = 1;
      g.stroke();
      // box: an opaque base keeps the leader line out of the text
      g.fillStyle = "rgb(31,31,36)";
      roundRect(g, bx, by, bw, bh, 10);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.06)";
      g.fill();
      if (it.sel) (g.strokeStyle = this.accent), (g.lineWidth = 1.5);
      else if (it.hot) (g.strokeStyle = rgba(this.accent, 0.6)), (g.lineWidth = 1);
      else (g.strokeStyle = "rgba(255,255,255,0.12)"), (g.lineWidth = 1);
      roundRect(g, bx + 0.75, by + 0.75, bw - 1.5, bh - 1.5, 9.5);
      g.stroke();
      rows.forEach((row, i) => {
        const cy = by + VPAD + i * ROW + ROW / 2, k = glyphOf(row);
        if (k) this.glyph(k, bx + PAD, cy - 7);
        const s = k ? row.slice(1).trimStart() : row;
        g.fillStyle = "rgb(237,237,242)";
        text(g, s, fnt, bx + PAD + (k ? GLY : 0), cy - lineH(11) / 2);
      });
    }
  }

  glyph(k: number, x: number, y: number) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.scale(14 / 16, 14 / 16);
    g.fillStyle = this.accent;
    g.fill(new Path2D(ICON_PATHS[(["actuation", "rapid", "haptics"] as const)[k - 1]]));
    g.restore();
  }

  drawThumb(v: number) {
    const g = this.g, t = this.thumbRect(v), hov = this.thumbHover && this.flip;
    g.fillStyle = `rgba(255,255,255,${hov ? 0.1 : 0.05})`;
    roundRect(g, t.x - 8, t.y - 8, t.w + 16, t.h + 38, 12);
    g.fill();
    if (hov) {
      g.strokeStyle = rgba(this.accent, 0.9);
      g.lineWidth = 1.5;
      g.stroke();
    }
    this.drawPicture(v, t, "", "");
    if (this.busy()) this.drawInput(picture(v), place(picture(v), t), t, v === 0);
    g.fillStyle = "rgb(217,219,230)";
    // the caption names the view that a click on the small picture switches to
    text(g, `${v ? tc("view", "Left side") : tc("view", "Top")}  ⟳`, font(9), t.x + t.w / 2, t.y + t.h + 6, 0.5);
  }

  // ---- view switching
  switchTo(to: number, animate: boolean) {
    if (to === this.target()) return;
    if (this.anim) {
      this.cur = this.anim.to;
      this.anim = null;
      if (to === this.cur) return this.draw();
    }
    if (animate && this.W) {
      this.anim = { t0: performance.now(), from: this.cur, to, p: 0 };
      this.tick();
    } else {
      this.cur = to;
      this.draw();
    }
  }
  userFlip() {
    const to = 1 - this.target();
    this.switchTo(to, true);
    this.props.onView?.(VIEWS[to]);
  }

  // ---- live input
  inputButton(zone: string, down: boolean) {
    this.held.set(zone, down);
    if (down) {
      this.ripples.push([zone, performance.now()]);
      this.press.set(zone, Math.max(this.press.get(zone) ?? 0, 0.35));
    }
    this.tick();
  }
  inputScroll(dy: number) {
    this.vel = Math.min(26, Math.max(-26, this.vel + 7 * dy));
    this.press.set("wheel", 1);
    this.tick();
  }

  /** One animation loop for the flip and the input effects; stops when nothing moves. */
  tick() {
    if (this.raf) return;
    this.last = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.anim) {
        const t = (now - this.anim.t0) / FLIP_MS;
        if (t >= 1) (this.cur = this.anim.to), (this.anim = null);
        else this.anim.p = 0.5 - 0.5 * Math.cos(Math.PI * t);
      }
      for (const [z, l] of this.press) {
        if (z === "wheel") continue;
        const target = this.held.get(z) ? 1 : 0;
        let n = l + (target - l) * Math.min(1, dt * (target ? 28 : 9));
        if (Math.abs(n - target) < 0.01) n = target;
        if (n > 0) this.press.set(z, n);
        else this.press.delete(z);
      }
      this.phase += this.vel * dt;
      this.vel *= Math.exp(-dt * 4);
      if (Math.abs(this.vel) < 0.05) this.vel = 0;
      if (this.vel) this.press.set("wheel", Math.min(1, Math.abs(this.vel) / 4));
      else this.press.delete("wheel");
      this.ripples = this.ripples.filter(([, t0]) => now - t0 < 600);
      this.draw();
      let busy = !!this.anim || this.vel !== 0 || this.ripples.length > 0;
      for (const [z, l] of this.press) busy ||= l > 0 && !(l === 1 && this.held.get(z));
      this.raf = busy ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }

  // ---- pointer
  local(e: React.PointerEvent): [number, number] {
    const b = this.canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  }
  setHover(z: string, pointer: boolean) {
    if (z !== this.hover) (this.hover = z), this.draw();
    this.canvas.style.cursor = pointer ? "pointer" : "";
  }
  move(x: number, y: number) {
    if (this.dragX !== null) this.dragDx = x - this.dragX;
    const th = this.inThumb(x, y);
    if (th !== this.thumbHover) (this.thumbHover = th), this.draw();
    const z = th ? "" : this.zoneAt(x, y);
    this.setHover(z, th || !!z || this.bodyAt(x, y));
  }
  release(x: number, y: number) {
    const dx = this.dragDx, dy = y - this.dragY;
    this.dragX = null;
    this.dragDx = 0;
    if (this.flip && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return this.userFlip();
    if (Math.abs(dx) > 8) return;
    if (this.inThumb(x, y)) return this.userFlip();
    const z = this.zoneAt(x, y);
    if (z) this.props.onZone?.(z as Zone);
    else if (this.bodyAt(x, y)) this.props.onBody?.();
  }
}

export function MouseView(props: MouseViewProps) {
  const shell = useStore((s) => s.shell);
  const accent = useStore((s) => s.accent);
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const r = useRef<Renderer | null>(null);
  const { pressed, wheelTick, wheelDelta } = useMouseInput();
  const seen = useRef<{ pressed: ReadonlySet<Zone>; tick: number } | null>(null);

  useLayoutEffect(() => {
    const rd = (r.current = new Renderer(canvas.current!));
    rd.props = props;
    rd.cur = VIEWS.indexOf(props.view);
    const ro = new ResizeObserver(() => rd.resize(host.current!.clientWidth, host.current!.clientHeight));
    ro.observe(host.current!);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rd.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastView = useRef(props.view);
  useLayoutEffect(() => {
    const rd = r.current!;
    rd.props = props;
    rd.shell = shell;
    rd.accent = accent;
    // follow `view` only when it changes: a flip by the user stands until the page asks for another view
    if (props.view !== lastView.current) {
      lastView.current = props.view;
      rd.switchTo(VIEWS.indexOf(props.view), true);
    }
    rd.draw();
  });

  // live input: the first render only records the state, so a page switch replays nothing
  useEffect(() => {
    const rd = r.current!;
    const prev = seen.current;
    seen.current = { pressed, tick: wheelTick };
    if (!prev) {
      for (const z of pressed) rd.held.set(z, true), rd.press.set(z, 1);
      if (pressed.size) rd.draw();
      return;
    }
    for (const z of pressed) if (!prev.pressed.has(z)) rd.inputButton(z, true);
    for (const z of prev.pressed) if (!pressed.has(z)) rd.inputButton(z, false);
    if (wheelTick !== prev.tick) rd.inputScroll(wheelDelta);
  }, [pressed, wheelTick, wheelDelta]);

  return (
    <div className="mouseview" ref={host}>
      <canvas ref={canvas} role="img" aria-label={props.view === "top" ? tc("view", "Top") : tc("view", "Left side")}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const [x, y] = r.current!.local(e);
          Object.assign(r.current!, { dragX: x, dragY: y, dragDx: 0 });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => r.current!.move(...r.current!.local(e))}
        onPointerUp={(e) => e.button === 0 && r.current!.release(...r.current!.local(e))}
        onPointerLeave={() => {
          const rd = r.current!;
          rd.thumbHover = false;
          rd.setHover("", false);
          rd.draw();
        }} />
    </div>
  );
}
