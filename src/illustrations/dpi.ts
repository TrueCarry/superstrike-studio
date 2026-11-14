import { ACCENT, clear, cursor, dot, monitor, mouse, mouseW, rgba } from "./engine";
import { scene } from "./scene";

/** The same hand move twice: at the normal DPI the cursor flies past the target, holding DPI shift it lands on it. `ratio` = shift DPI / normal DPI. */
export const dpi = scene<{ ratio?: number }>({
  duration: 3.6,
  still: 2.7,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    const P = 1.8, shift = t >= P, u = (t % P) / P;
    const swing = u < 0.12 || u > 0.88 ? 0 : Math.sin(((u - 0.12) / 0.76) * Math.PI);
    const normal = 3.6, gain = shift ? normal * Math.min(1, v.ratio ?? 0.2) : normal;
    const sx = w / 2, sy = 100, tx = sx + 36;
    clear(g, w, h);
    monitor(g, 40, 22, w - 80, 156);
    const hit = shift && swing > 0.92 && Math.abs(sx + 50 * gain - tx) < 16;
    g.strokeStyle = hit ? ACCENT : "rgba(255,255,255,0.55)";
    g.fillStyle = hit ? rgba(ACCENT, 0.25) : "rgba(0,0,0,0)";
    g.lineWidth = 2.5;
    for (const r of [16, 8]) (dot(g, tx, sy, r), g.fill(), g.stroke());
    g.beginPath();
    for (const [a, b] of [[-24, -18], [18, 24]]) {
      g.moveTo(tx + a, sy);
      g.lineTo(tx + b, sy);
      g.moveTo(tx, sy + a);
      g.lineTo(tx, sy + b);
    }
    g.stroke();
    const at = (s: number) => {
      const q = (((s % P) + P) % P) / P;
      return Math.min(w - 40, sx + (q < 0.12 || q > 0.88 ? 0 : Math.sin(((q - 0.12) / 0.76) * Math.PI)) * 50 * gain);
    };
    for (let i = 12; i > 0; i--) {
      const s0 = t - (i * 0.5) / 12, s1 = t - ((i - 1) * 0.5) / 12;
      if (s0 < (shift ? P : 0)) continue;
      g.strokeStyle = rgba(shift ? ACCENT : "#ffffff", 0.7 * (1 - i / 12));
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(at(s0), sy);
      g.lineTo(at(s1), sy);
      g.stroke();
    }
    cursor(g, at(t), sy);
    mouse(g, w / 2 - mouseW(150) / 2 + swing * 50, 196, 150, { side: shift ? 1 : 0 });
  },
});
