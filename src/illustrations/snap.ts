import { ACCENT, clear, cursor, ease, monitor, mouse, mouseW, seg } from "./engine";
import { columns, scene } from "./scene";

/** The same slightly shaky hand per mouse: without angle snapping the line wobbles, with it the line is straight. */
export const snap = scene<{ on: boolean[] }>({
  duration: 2.8,
  still: 1.9,
  size: (v) => [240 * v.on.length, 360],
  draw(g, t, v, w, h) {
    const u = ease(seg(t, 0.2, 2.0)), fade = 1 - seg(t, 2.45, 2.8);
    const wobble = (s: number) => 0.22 * Math.sin(s * 9.1) + 0.12 * Math.sin(s * 23 + 1) + 0.06 * Math.sin(s * 41 + 2);
    clear(g, w, h);
    columns(v.on.length, w).forEach((cx, i) => {
      const on = v.on[i];
      monitor(g, cx - 100, 22, 200, 150);
      const at = (s: number): [number, number] => [cx - 80 + 160 * s, 97 + (on ? 0 : wobble(s) * 60)];
      g.globalAlpha = fade;
      g.strokeStyle = on ? ACCENT : "#ffffff";
      g.lineWidth = 3;
      g.lineCap = g.lineJoin = "round";
      g.beginPath();
      for (let k = 0; k <= 60; k++) {
        const [px, py] = at((u * k) / 60);
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
      cursor(g, ...at(u));
      g.globalAlpha = 1;
      mouse(g, cx - mouseW(130) / 2 + (u - 0.5) * 70, 200 + wobble(u) * 30, 130);
    });
  },
});
