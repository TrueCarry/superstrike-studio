import { ACCENT, clear, ease, mouse, mouseW, rgba, seg } from "./engine";
import { scene } from "./scene";

const fmt = (s: number) => (s >= 3600 ? `${Math.round(s / 360) / 10} h` : s >= 60 ? `${Math.round(s / 6) / 10} min` : `${s} s`);

// idle time runs from 0 to `sleep` over IDLE, the mouse sleeps until MOVE, a move wakes it and the
// timer drains back to 0 by AWAKE, then it rests awake until the loop starts again
const IDLE = [0.3, 3.0], MOVE = 3.8, AWAKE = 4.7;

/**
 * The mouse left alone: after `low` seconds it dims to low power, after `sleep` seconds it sleeps, and a
 * move wakes it. The timeline under it is marked with both times.
 */
export const power = scene<{ low: number; sleep: number }>({
  duration: 5.8,
  still: 2.4,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    const sleep = Math.max(v.sleep, v.low + 1);
    const tLow = IDLE[0] + ((IDLE[1] - IDLE[0]) * v.low) / sleep;
    const woke = t >= MOVE, idle = woke ? 0 : seg(t, IDLE[0], IDLE[1]) * sleep;
    // brightness: dims at the low power mark, dims more at sleep, fades back up on the move
    const level = woke ? 0.35 + 0.65 * ease(seg(t, MOVE + 0.05, MOVE + 0.4))
      : 1 - 0.35 * ease(seg(t, tLow, tLow + 0.25)) - 0.3 * ease(seg(t, IDLE[1], IDLE[1] + 0.25));
    const asleep = t >= IDLE[1] && !woke;
    // the move: the hand slides the mouse right and back
    const slide = Math.sin(Math.PI * ease(seg(t, MOVE - 0.05, MOVE + 0.55))) * 34;
    clear(g, w, h);
    const mh = 220, mw = mouseW(mh), mx = (w - mw) / 2 + slide, my = 18;
    if (slide > 2) { // motion lines behind the moving mouse
      g.strokeStyle = `rgba(255,255,255,${0.35 * (slide / 34)})`;
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      for (const dy of [70, 110, 150]) (g.moveTo(mx - 14 - slide * 0.9, my + dy), g.lineTo(mx - 14, my + dy));
      g.stroke();
    }
    g.globalAlpha = level;
    mouse(g, mx, my, mh);
    g.globalAlpha = 1;
    // status light, with a ring when it comes back on
    const lx = w / 2, ly = my + mh + 16;
    g.fillStyle = asleep ? "rgba(255,255,255,0.15)" : rgba(ACCENT, 0.3 + 0.7 * level);
    g.beginPath();
    g.arc(lx, ly, 6, 0, Math.PI * 2);
    g.fill();
    const ring = seg(t, MOVE + 0.05, MOVE + 0.75);
    if (ring > 0 && ring < 1) {
      g.strokeStyle = rgba(ACCENT, 0.8 * (1 - ring));
      g.lineWidth = 2;
      g.beginPath();
      g.arc(lx, ly, 6 + 22 * ease(ring), 0, Math.PI * 2);
      g.stroke();
    }
    if (asleep) {
      const fade = seg(t, IDLE[1], IDLE[1] + 0.3) * (1 - seg(t, MOVE - 0.15, MOVE));
      g.fillStyle = `rgba(255,255,255,${0.75 * fade})`;
      g.font = "700 22px system-ui, sans-serif";
      g.fillText("z", mx + mw + 6, my + 60 - 8 * Math.sin(t * 3));
      g.font = "700 16px system-ui, sans-serif";
      g.fillText("z", mx + mw + 22, my + 40 - 6 * Math.sin(t * 3 + 1));
    }
    // timeline with both marks; after the move it drains back to 0
    const x0 = 40, x1 = w - 40, y = 312, xOf = (s: number) => x0 + ((x1 - x0) * s) / sleep;
    const shown = woke ? sleep * (1 - ease(seg(t, MOVE + 0.15, AWAKE))) : idle;
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
    g.roundRect(x0, y - 4, Math.max(8, xOf(shown) - x0), 8, 4);
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
