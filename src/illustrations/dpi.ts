import { ACCENT, clear, cursor, dot, monitor, mouse, mouseW, rgba } from "./engine";
import { scene } from "./scene";

/**
 * The same hand move twice, first at the `normal` DPI, then holding DPI shift at `shift` DPI. The cursor
 * travels in proportion to each value. The target sits where the shift move ends, so a lower shift DPI
 * shows the normal move flying past it and the shifted one landing on it.
 */
export const dpi = scene<{ normal: number; shift: number }>({
  duration: 3.6,
  still: 2.7,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    const P = 1.8, shift = t >= P, u = (t % P) / P;
    const wave = (q: number) => (q < 0.12 || q > 0.88 ? 0 : Math.sin(((q - 0.12) / 0.76) * Math.PI));
    const swing = wave(u);
    const top = Math.max(v.normal, v.shift, 1);
    const sx = 84, reach = w - 2 * sx, sy = 108;
    const dist = (d: number) => reach * Math.max(0.08, d / top);
    const now = shift ? v.shift : v.normal, tx = sx + dist(v.shift);
    clear(g, w, h);
    monitor(g, 40, 22, w - 80, 156);
    g.font = "800 15px system-ui, sans-serif";
    g.fillStyle = shift ? ACCENT : "rgba(255,255,255,0.75)";
    g.textAlign = "center";
    g.fillText(`${now} DPI`, w / 2, 56);
    g.textAlign = "start";
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(sx - 1, sy - 14, 2, 28);
    const hit = swing > 0.92 && Math.abs(dist(now) - dist(v.shift)) < 10;
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
    const at = (s: number) => sx + wave((((s % P) + P) % P) / P) * dist(now);
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
    mouse(g, w / 2 - mouseW(150) / 2 - 25 + swing * 50, 196, 150, { side: shift ? 1 : 0 });
  },
});
