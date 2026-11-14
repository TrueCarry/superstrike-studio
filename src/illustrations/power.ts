import { ACCENT, clear, mouse, mouseW, rgba, seg } from "./engine";
import { scene } from "./scene";

const fmt = (s: number) => (s >= 3600 ? `${Math.round(s / 360) / 10} h` : s >= 60 ? `${Math.round(s / 6) / 10} min` : `${s} s`);

/**
 * The mouse left alone: after `low` seconds it dims to low power, after `sleep` seconds it sleeps, and a
 * move wakes it. The timeline under it is marked with both times.
 */
export const power = scene<{ low: number; sleep: number }>({
  duration: 4.2,
  still: 2.1,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    const sleep = Math.max(v.sleep, v.low + 1);
    // idle time shown: 0..sleep over 0.2..3.0 s, then a move wakes the mouse
    const idle = seg(t, 0.2, 3.0) * sleep, wake = seg(t, 3.15, 3.5);
    const low = idle >= v.low && wake === 0, asleep = idle >= sleep - 1e-6 && wake === 0;
    clear(g, w, h);
    const mh = 220, mw = mouseW(mh), mx = (w - mw) / 2 + (wake > 0 ? Math.sin(wake * Math.PI * 2) * 10 : 0), my = 18;
    g.globalAlpha = asleep ? 0.35 : low ? 0.65 : 1;
    mouse(g, mx, my, mh);
    g.globalAlpha = 1;
    // status light
    const lx = w / 2, ly = my + mh + 16;
    g.fillStyle = asleep ? "rgba(255,255,255,0.15)" : low ? rgba(ACCENT, 0.45) : ACCENT;
    g.beginPath();
    g.arc(lx, ly, 6, 0, Math.PI * 2);
    g.fill();
    if (asleep) {
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.font = "700 22px system-ui, sans-serif";
      g.fillText("z", mx + mw + 6, my + 60 - 8 * Math.sin(t * 3));
      g.font = "700 16px system-ui, sans-serif";
      g.fillText("z", mx + mw + 22, my + 40 - 6 * Math.sin(t * 3 + 1));
    }
    // timeline with both marks
    const x0 = 40, x1 = w - 40, y = 312, xOf = (s: number) => x0 + ((x1 - x0) * s) / sleep;
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.beginPath();
    g.roundRect(x0, y - 4, x1 - x0, 8, 4);
    g.fill();
    g.fillStyle = rgba(ACCENT, 0.4);
    g.beginPath();
    g.roundRect(xOf(v.low), y - 4, xOf(sleep) - xOf(v.low), 8, 4);
    g.fill();
    g.fillStyle = ACCENT;
    g.beginPath();
    g.roundRect(x0, y - 4, Math.max(8, xOf(wake > 0 ? 0 : idle) - x0), 8, 4);
    g.fill();
    g.font = "600 12px system-ui, sans-serif";
    g.textAlign = "center";
    for (const [s, label] of [[v.low, fmt(v.low)], [sleep, fmt(sleep)]] as const) {
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.fillRect(xOf(s) - 1, y - 12, 2, 24);
      g.fillText(label, Math.min(x1 - 20, Math.max(x0 + 20, xOf(s))), y + 30);
    }
    g.textAlign = "start";
  },
});
