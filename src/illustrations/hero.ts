import { ACCENT, ORANGE, bubble, callout, clamp, clear, dot, ease, mouse, mouseW, rgba, seg, type MouseOpts } from "./engine";
import { picture } from "./picture";
import { scene } from "./scene";

const ORDER = ["actuation", "rapid", "haptics", "sensor", "buttons", "profiles"];

/** Every feature in turn on the mouse, each leaving a callout; at the end they all go into the mouse. */
export const hero = scene<Record<string, never>>({
  duration: 7.2,
  still: 5.5,
  size: () => [720, 380],
  draw(g, t, _v, w, h) {
    const B = 0.85, start = (i: number) => 0.3 + i * B;
    const beat = Math.floor((t - 0.3) / B), u = t - start(beat);
    const gather = ease(seg(t, 5.6, 6.2)), fade = 1 - seg(t, 6.85, 7.2);
    clear(g, w, h);
    const ph = 340, top = picture("top"), k = ph / top.h, cx = w / 2;
    const shake = beat === 3 ? Math.sin(seg(u, 0, 0.7) * Math.PI * 2) * 22 : 0;
    const x = cx - mouseW(ph) / 2 + shake, y = 18;
    const o: MouseOpts = {};
    if (beat === 0) Object.assign(o, { press: Math.sin(seg(u, 0, 0.5) * Math.PI), glow: seg(u, 0.15, 0.25) * (1 - seg(u, 0.45, 0.6)), ripples: u > 0.22 ? [[u - 0.22, ACCENT]] : [] });
    if (beat === 1) {
      const taps = [0.05, 0.25, 0.45].filter((s) => u > s);
      Object.assign(o, { press: taps.length && u - taps.at(-1)! < 0.1 ? 1 : 0, glow: taps.length ? clamp(1 - (u - taps.at(-1)!) / 0.18) : 0, ripples: taps.map((s) => [u - s, ORANGE]) });
    }
    if (beat === 2) Object.assign(o, { zone: "btn-right", press: u < 0.15 ? 1 : 0, glow: clamp(1 - u / 0.3), ripples: [[u, ACCENT]] });
    if (beat === 4) o.side = Math.sin(seg(u, 0, 0.7) * Math.PI);
    const halo = (beat === 5 ? Math.sin(seg(u, 0, 0.7) * Math.PI) : 0) + (t > 6.2 ? 1 - seg(t, 6.2, 6.9) : 0);
    if (halo > 0) {
      g.save();
      g.translate(x, y);
      g.scale(k, k);
      g.strokeStyle = rgba(ACCENT, 0.7 * halo);
      g.lineWidth = 26;
      g.stroke(top.parts.find((p) => p.kind === "body")!.path);
      g.restore();
    }
    const buzz = beat === 2 ? 3 * Math.sin(u * 2 * Math.PI * 24) * Math.exp(-u * 8) : 0;
    mouse(g, x + buzz, y, ph, o);
    if (beat === 2 && u < 0.45)
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = rgba(ACCENT, (1 - u / 0.45) * 0.8);
        g.lineWidth = 4;
        g.lineCap = "round";
        for (const a of [Math.PI, 0]) {
          g.beginPath();
          g.arc(cx, y + 200 * k, mouseW(ph) / 2 + 14 + i * 13 + u * 40, a - 0.4, a + 0.4);
          g.stroke();
        }
      }
    if (t > 6.2) {
      const r = seg(t, 6.2, 6.8);
      g.strokeStyle = rgba(ACCENT, 0.8 * (1 - r));
      g.lineWidth = 4;
      dot(g, cx, y + ph * 0.5, 40 + r * 260);
      g.stroke();
    }
    const at = (dx: number, dy: number) => [x + dx * k, y + dy * k];
    const items: [string, number[], number, number][] = [
      ["actuation", at(140, 250), 150, 70], ["rapid", at(150, 380), 150, 190], ["buttons", at(28, 497), 150, 310],
      ["haptics", at(370, 250), w - 150, 70], ["sensor", at(255, 760), w - 150, 190], ["profiles", at(420, 860), w - 150, 310],
    ];
    for (const [name, [zx, zy], bx, by] of items) {
      const s0 = start(ORDER.indexOf(name)), pop = seg(t, s0, s0 + 0.25);
      if (pop <= 0) continue;
      const color = name === "rapid" ? ORANGE : ACCENT;
      g.globalAlpha = fade;
      if (gather <= 0) callout(g, zx, zy, bx, by, 64, name, pop, color);
      else if (gather < 1) bubble(g, bx + (cx - bx) * gather, by + (y + ph * 0.5 - by) * gather, 64 * (1 - gather), name, color);
      g.globalAlpha = 1;
    }
  },
});
