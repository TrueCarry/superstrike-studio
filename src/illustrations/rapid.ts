import { ACCENT, ORANGE, clear, clicks, counter, ease, gauge, glowOf, mouse, mouseW, seg } from "./engine";
import { columns, scene } from "./scene";

/** The same quick bounces of the button per mouse: rapid trigger 0 (off) counts one click, 1..5 counts the bounces that lift far enough. */
export const rapid = scene<{ rt: number[] }>({
  duration: 3.1,
  still: 1.3,
  size: (v) => [240 * v.rt.length, 360],
  draw(g, t, v, w, h) {
    const depth = (s: number) => {
      if (s < 0.2) return 0;
      if (s < 0.6) return 0.95 * ease(seg(s, 0.2, 0.6));
      if (s < 1.88) return 0.95 - 0.3 * Math.sin(((s - 0.6) / 0.32) * Math.PI) ** 2;
      if (s < 2.25) return 0.95 * (1 - ease(seg(s, 1.88, 2.25)));
      return 0;
    };
    clear(g, w, h);
    columns(v.rt.length, w).forEach((cx, i) => {
      const rt = v.rt[i] ? 0.05 + v.rt[i] * 0.05 : 0;
      const x = cx - mouseW(290) / 2 + 16, c = clicks(depth, t, 0.45, rt), color = rt ? ORANGE : ACCENT;
      const m = mouse(g, x, 18, 290, { press: depth(t), glow: glowOf(c, t), ripples: c.times.map((s) => [t - s, color]) });
      gauge(g, x - 32, m.top + 10, m.bottom - 10, { depth: depth(t), at: 0.45, clicked: c.pressed, band: rt && c.pressed ? [c.hi - rt, c.hi] : null });
      counter(g, cx, 338, 5, t < 2.75 ? c.times : [], color, t);
    });
  },
});
