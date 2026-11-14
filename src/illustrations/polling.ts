import { ACCENT, clear, cursor, dot, monitor, mouse, mouseW, rgba } from "./engine";
import { columns, scene } from "./scene";

/** The same hand loop per mouse; the cursor only moves when the mouse reports. `rate` is the polling rate index 0 (125 Hz) .. 6 (8 000 Hz). */
export const polling = scene<{ rate: number[] }>({
  duration: 2.4,
  still: 0.8,
  size: (v) => [240 * v.rate.length, 360],
  draw(g, t, v, w, h) {
    const T = 2.4;
    const path = (s: number) => [Math.sin((2 * Math.PI * s) / T), Math.sin((4 * Math.PI * s) / T) / 2];
    clear(g, w, h);
    columns(v.rate.length, w).forEach((cx, i) => {
      // slowed down so the steps are visible: 125 Hz is a step every 0.12 s, each rate halves it
      const every = Math.max(0.01, 0.12 / 2 ** v.rate[i]), color = every > 0.02 ? "#ffffff" : ACCENT;
      monitor(g, cx - 100, 22, 200, 150);
      const sy = 97, ax = 76, ay = 92;
      const sample = (s: number) => path(Math.floor(s / every) * every);
      g.lineJoin = g.lineCap = "round";
      const n = Math.round(1 / every);
      for (let k = n; k > 0; k--) {
        const a = sample(t - k * every), b = sample(t - (k - 1) * every);
        g.strokeStyle = rgba(color, 0.8 * (1 - k / n));
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cx + a[0] * ax, sy + a[1] * ay);
        g.lineTo(cx + b[0] * ax, sy + b[1] * ay);
        g.stroke();
        if (every > 0.02) {
          g.fillStyle = g.strokeStyle;
          dot(g, cx + b[0] * ax, sy + b[1] * ay, 3.5);
          g.fill();
        }
      }
      const [px, py] = sample(t);
      cursor(g, cx + px * ax, sy + py * ay);
      const [mx, my] = path(t);
      mouse(g, cx - mouseW(130) / 2 + mx * 34, 200 + my * 24, 130);
    });
  },
});
