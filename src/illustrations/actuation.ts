import { ACCENT, clear, clicks, ease, gauge, glowOf, mouse, mouseW, seg } from "./engine";
import { columns, scene } from "./scene";

/** One press per mouse; each clicks at its own point (1 hair-trigger .. 10 deep). The bar shows how long the press took to click. */
export const actuation = scene<{ act: number[] }>({
  duration: 3,
  still: 0.75,
  size: (v) => [240 * v.act.length, 360],
  draw(g, t, v, w, h) {
    const depth = (s: number) => (s < 0.2 ? 0 : s < 1.3 ? seg(s, 0.2, 1.3) : s < 1.6 ? 1 : s < 2.1 ? 1 - ease(seg(s, 1.6, 2.1)) : 0);
    clear(g, w, h);
    columns(v.act.length, w).forEach((cx, i) => {
      const A = 0.06 + ((v.act[i] - 1) / 9) * 0.88;
      const x = cx - mouseW(290) / 2 + 16, c = clicks(depth, t, A);
      const fired = clicks(depth, 3, A).times[0];
      const m = mouse(g, x, 18, 290, { press: depth(t), glow: glowOf(c, t), ripples: c.times.map((s) => [t - s, ACCENT]) });
      gauge(g, x - 32, m.top + 10, m.bottom - 10, { depth: depth(t), at: A, clicked: c.pressed });
      g.fillStyle = "rgba(255,255,255,0.10)";
      g.beginPath();
      g.roundRect(cx - 60, 334, 120, 10, 5);
      g.fill();
      if (t > 0.2 && t < 2.2) {
        g.fillStyle = ACCENT;
        g.beginPath();
        g.roundRect(cx - 60, 334, Math.max(10, (Math.min(t, fired) - 0.2) * 100), 10, 5);
        g.fill();
      }
    });
  },
});
