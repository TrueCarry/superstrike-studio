import { ACCENT, clamp, clear, dot, ease, icon, mouse, pills, seg } from "./engine";
import { scene } from "./scene";

/** [click point 1..10, speed 0..1, haptics 0..5] per profile */
const DEMO: [number, number, number][] = [[3, 0.3, 3], [8, 0.85, 1], [5, 0.55, 5], [1, 1, 0], [7, 0.4, 2]];

/**
 * One press of the profile button and click point, speed and click strength switch together. `values`
 * are the profiles in the cycle, `names` their names (shown under the dots).
 */
export const profiles = scene<{ values?: [number, number, number][]; names?: string[] }>({
  duration: 4,
  still: 0.6,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    const values = v.values?.length ? v.values : DEMO, n = values.length, P = 4 / n;
    const k = Math.floor(t / P) % n, u = t - Math.floor(t / P) * P, prev = values[(k + n - 1) % n], cur = values[k];
    const m = ease(seg(u, 0.12, 0.42)), val = prev.map((a, i) => a + (cur[i] - a) * m);
    clear(g, w, h);
    mouse(g, 46, 22, 290, { side: clamp(1 - u / 0.35) });
    const x0 = 240, x1 = w - 30, rows = [80, 160, 240], bx = x0 + 30, bw = x1 - bx;
    icon(g, "actuation", x0, rows[0] - 9, 18, "rgb(191,194,204)");
    const sw = bw / 10;
    for (let i = 1; i <= 10; i++) {
      g.fillStyle = Math.abs(i - val[0]) < 0.5 ? ACCENT : i < val[0] ? "rgba(255,255,255,0.1)" : "rgba(59,156,255,0.38)";
      g.beginPath();
      g.roundRect(bx + (i - 1) * sw + 1.5, rows[0] - 10, sw - 3, 20, 3);
      g.fill();
    }
    icon(g, "sensor", x0, rows[1] - 9, 18, "rgb(191,194,204)");
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.beginPath();
    g.roundRect(bx, rows[1] - 6, bw, 12, 6);
    g.fill();
    g.fillStyle = ACCENT;
    g.beginPath();
    g.roundRect(bx, rows[1] - 6, Math.max(12, bw * val[1]), 12, 6);
    g.fill();
    icon(g, "haptics", x0, rows[2] - 9, 18, "rgb(191,194,204)");
    pills(g, bx, rows[2] - 9, bw, 18, 6, Math.round(val[2]));
    for (let i = 0; i < n; i++) {
      const on = i === k, pop = on ? Math.sin(seg(u, 0, 0.3) * Math.PI) : 0;
      g.fillStyle = on ? ACCENT : "rgba(255,255,255,0.14)";
      dot(g, bx + (n > 1 ? (i * bw) / (n - 1) : bw / 2), 310, 8 * (1 + 0.4 * pop));
      g.fill();
    }
    const name = v.values?.length ? v.names?.[k] : undefined;
    if (name) {
      g.font = "700 14px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.globalAlpha = clamp(u / 0.25);
      g.fillText(name.length > 24 ? name.slice(0, 23) + "…" : name, bx + bw / 2, 342);
      g.globalAlpha = 1;
      g.textAlign = "start";
    }
  },
});
