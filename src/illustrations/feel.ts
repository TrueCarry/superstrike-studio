import { ACCENT, ORANGE, clear, clicks, ease, gauge, glowOf, mouse, mouseW, pills, seg, zonesOf, type Target } from "./engine";
import { scene } from "./scene";

/**
 * A whole click feel on one mouse: a press, then quick bounces. It clicks at `act` (1..10), re-clicks on
 * the bounces with rapid trigger `rt` (0 off, 1..5) and shakes for haptics `hap` (0..5). `on` picks the
 * button pressed: left, right or both (default left).
 */
export const feel = scene<{ act: number; rt: number; hap: number; on?: Target }>({
  duration: 2.6,
  still: 0.9,
  size: () => [260, 330],
  draw(g, t, v, w, h) {
    const depth = (s: number) => {
      if (s < 0.15) return 0;
      if (s < 0.5) return 0.95 * ease(seg(s, 0.15, 0.5));
      if (s < 1.62) return 0.95 - 0.32 * Math.sin(((s - 0.5) / 0.28) * Math.PI) ** 2;
      if (s < 1.95) return 0.95 * (1 - ease(seg(s, 1.62, 1.95)));
      return 0;
    };
    clear(g, w, h);
    const A = 0.06 + ((v.act - 1) / 9) * 0.88, rt = v.rt ? 0.05 + v.rt * 0.05 : 0;
    const c = clicks(depth, t, A, rt), color = rt ? ORANGE : ACCENT;
    const age = c.times.length ? t - c.times.at(-1)! : 9;
    const buzz = v.hap * 1.1 * Math.sin(age * 2 * Math.PI * 24) * Math.exp(-age * 9);
    const right = v.on === "right", mh = 260, mw = mouseW(mh), x = (w - mw) / 2 + (right ? -14 : 14) + buzz;
    const m = mouse(g, x, 12, mh, { zones: zonesOf(v.on), press: depth(t), glow: glowOf(c, t), ripples: c.times.map((s) => [t - s, color]) });
    gauge(g, right ? x + mw + 16 : x - 30, m.top + 8, m.bottom - 8, { depth: depth(t), at: A, clicked: c.pressed, band: rt && c.pressed ? [c.hi - rt, c.hi] : null });
    pills(g, 30, h - 30, w - 60, 14, 6, v.hap);
  },
});
