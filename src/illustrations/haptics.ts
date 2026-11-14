import { ACCENT, clear, clicks, ease, glowOf, mouse, mouseW, pills, seg } from "./engine";
import { scene } from "./scene";

/** Clicks with the mouse shaking for the click strength: `level` 0..5, or every level in turn when unset. */
export const haptics = scene<{ level?: number }>({
  duration: 3.9,
  still: 3.24,
  size: (v) => [v.level === undefined ? 480 : 300, 360],
  draw(g, t, v, w, h) {
    const P = 0.62;
    const depth = (s: number) => {
      const k = Math.floor(s / P), u = s - k * P;
      if (k > 5) return 0;
      return u < 0.1 ? 0 : u < 0.2 ? ease(seg(u, 0.1, 0.2)) : u < 0.26 ? 1 : u < 0.38 ? 1 - ease(seg(u, 0.26, 0.38)) : 0;
    };
    clear(g, w, h);
    const c = clicks(depth, t, 0.5);
    const level = v.level ?? (c.times.length ? c.times.length - 1 : 0);
    const age = c.times.length ? t - c.times.at(-1)! : 9;
    const buzz = level * 1.3 * Math.sin(age * 2 * Math.PI * 24) * Math.exp(-age * 9);
    const mw = mouseW(290);
    const m = mouse(g, (w - mw) / 2 + buzz, 18, 290, { press: depth(t), glow: glowOf(c, t), ripples: c.times.map((s) => [t - s, ACCENT]) });
    if (age < 0.45)
      for (let i = 0; i < level; i++) {
        g.strokeStyle = ACCENT;
        g.globalAlpha = (1 - age / 0.45) * (0.45 + 0.1 * level);
        g.lineWidth = 4;
        g.lineCap = "round";
        const r = Math.min(mw / 2 + 14 + i * 13 + age * 40, w / 2 - 4);
        for (const a of [Math.PI, 0]) {
          g.beginPath();
          g.arc(w / 2, m.by, r, a - 0.42, a + 0.42);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
    const pw = Math.min(306, w - 40);
    pills(g, (w - pw) / 2, 326, pw, 20, 6, level);
  },
});
