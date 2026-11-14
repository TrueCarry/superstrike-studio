import { ACCENT, ORANGE, clamp, clear, dot, mouse, rgba } from "./engine";
import { picture } from "./picture";
import { scene } from "./scene";

/** Wheel ticks of a fast flick in ms: a bunny-hop burst, then a few slow steps. */
const TICKS = [0, 22, 48, 70, 96, 122, 150, 172, 200, 232, 480, 690, 900];
const SPAN = 1000, T0 = 0.25, T1 = 2.45;

/**
 * Scroll filter `ms` (0 off .. 1000) on a timeline of real milliseconds. A tick that comes sooner than the
 * filter window (orange) after the last one passed is dropped (grey, under the line); the others go
 * through (blue) and move the page. Off, every tick goes through.
 */
export const scroll = scene<{ ms: number }>({
  duration: 2.9,
  still: 1.5,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    let last = -1e9;
    const passed = TICKS.map((s) => (s - last >= v.ms ? ((last = s), true) : false));
    const now = ((t - T0) / (T1 - T0)) * SPAN;
    const shown = TICKS.map((s) => s <= now);
    clear(g, w, h);
    // the mouse, its wheel rolling with every tick
    const mh = 200, mx = 40, my = 20;
    mouse(g, mx, my, mh);
    const pic = picture("top"), wheel = pic.zones.get("wheel")!, ws = mh / pic.h;
    const wx = mx + wheel.cx * ws, wy = my + wheel.cy * ws, spin = shown.filter(Boolean).length;
    g.save();
    g.beginPath();
    g.roundRect(wx - 8, wy - 26, 16, 52, 7);
    g.clip();
    g.fillStyle = rgba(ACCENT, 0.35 * clamp(1 - (now - Math.max(...TICKS.filter((s) => s <= now), -999)) / 120));
    g.fillRect(wx - 8, wy - 26, 16, 52);
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.lineWidth = 2;
    for (let i = -4; i <= 4; i++) {
      const y = wy + ((((i * 9 + spin * 4) % 36) + 36) % 36) - 18;
      g.beginPath();
      g.moveTo(wx - 6, y);
      g.lineTo(wx + 6, y);
      g.stroke();
    }
    g.restore();
    // the page: one line moves per tick that goes through
    const steps = TICKS.filter((s, i) => s <= now && passed[i]).length;
    const px = 230, pw = w - px - 30, py = 30, ph = 170;
    g.fillStyle = "#2b2f38";
    g.beginPath();
    g.roundRect(px, py, pw, ph, 10);
    g.fill();
    g.save();
    g.beginPath();
    g.roundRect(px, py, pw, ph, 10);
    g.clip();
    for (let i = 0; i < 24; i++) {
      const y = py + 18 + i * 20 - steps * 20 * 0.5;
      g.fillStyle = i % 5 === 0 ? rgba(ACCENT, 0.6) : "rgba(255,255,255,0.14)";
      g.beginPath();
      g.roundRect(px + 16, y, (pw - 32) * (i % 3 === 2 ? 0.6 : 0.9), 8, 4);
      g.fill();
    }
    g.restore();
    // the timeline: filter windows, then ticks
    const x0 = 34, x1 = w - 34, ly = 290, xOf = (ms: number) => x0 + ((x1 - x0) * ms) / SPAN;
    g.fillStyle = "rgba(255,255,255,0.15)";
    g.fillRect(x0, ly - 1, x1 - x0, 2);
    TICKS.forEach((s, i) => {
      if (!shown[i] || !passed[i] || !v.ms) return;
      g.fillStyle = rgba(ORANGE, 0.22);
      g.beginPath();
      g.roundRect(xOf(s), ly - 14, Math.min(xOf(s + v.ms), x1) - xOf(s), 28, 6);
      g.fill();
    });
    TICKS.forEach((s, i) => {
      if (!shown[i]) return;
      const pop = Math.sin(clamp((now - s) / 60) * Math.PI);
      g.fillStyle = passed[i] ? ACCENT : "rgba(255,255,255,0.3)";
      dot(g, xOf(s), passed[i] ? ly : ly + 22, 4.5 + 2 * pop);
      g.fill();
    });
    g.fillStyle = "rgba(255,255,255,0.75)";
    dot(g, xOf(clamp(now, 0, SPAN)), ly, 2);
    g.fill();
    g.font = "600 12px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fillText("0", x0 - 4, ly + 44);
    g.textAlign = "end";
    g.fillText(`${SPAN} ms`, x1 + 4, ly + 44);
    g.textAlign = "start";
  },
});
