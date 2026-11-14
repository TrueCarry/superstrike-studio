import { ACCENT, clear, cursor, dot, ease, monitor, rgba, seg } from "./engine";
import { outline, picture } from "./picture";
import { scene } from "./scene";

/**
 * Gaming surface mode: the sensor reads the pad's texture. `mode` 0 auto, 1 on, 2 off. Tuned (auto or on)
 * the scan locks onto the pad and the cursor path is smooth; off it stays a little shaky.
 */
export const surface = scene<{ mode: number }>({
  duration: 3.2,
  still: 2.2,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    const tuned = v.mode !== 2, scan = seg(t, 0.1, 1.1), lock = tuned ? ease(seg(t, 1.0, 1.4)) : 0;
    const u = ease(seg(t, 1.3, 2.8)), fade = 1 - seg(t, 2.9, 3.2);
    const jitter = (s: number) => (1 - lock) * (0.5 * Math.sin(s * 47) + 0.35 * Math.sin(s * 91 + 1) + 0.15 * Math.sin(s * 173 + 2));
    clear(g, w, h);
    // the screen and the cursor path
    monitor(g, 40, 22, w - 80, 130);
    const at = (s: number): [number, number] => [80 + (w - 160) * s, 87 + jitter(s) * 14];
    g.globalAlpha = fade;
    g.strokeStyle = tuned ? ACCENT : "#fff";
    g.lineWidth = 3;
    g.lineCap = g.lineJoin = "round";
    g.beginPath();
    for (let k = 0; k <= 80; k++) {
      const [px, py] = at((u * k) / 80);
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    cursor(g, ...at(u));
    g.globalAlpha = 1;
    // the pad: a weave texture
    const py = 236, ph = 104;
    g.fillStyle = "#2c2c33";
    g.beginPath();
    g.roundRect(30, py, w - 60, ph, 14);
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = "rgba(255,255,255,0.06)";
    g.lineWidth = 1;
    for (let x = 30; x < w; x += 7) (g.beginPath(), g.moveTo(x, py), g.lineTo(x - 30, py + ph), g.stroke());
    for (let x = 0; x < w + 30; x += 7) (g.beginPath(), g.moveTo(x, py), g.lineTo(x + 30, py + ph), g.stroke());
    g.restore();
    // the mouse from the side, its sensor scanning the pad
    const s = 0.2, mx = w / 2 - 488 * s + (u - 0.5) * 120, my = py + 8;
    g.save();
    g.translate(mx, my);
    g.rotate(-Math.PI / 2);
    g.scale(s, s);
    g.translate(-12, -12);
    outline(g, picture("side"));
    g.restore();
    const sx = mx + 480 * s, sy = my + 2;
    const r = 6 + 26 * (tuned ? lock : 0.5 + 0.5 * Math.sin(t * 9)) + (1 - scan) * 10;
    g.fillStyle = rgba(tuned ? ACCENT : "#ffffff", tuned ? 0.12 + 0.18 * lock : 0.12);
    g.beginPath();
    g.ellipse(sx, py + 4, r * 1.8, 6 + r * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = tuned ? ACCENT : "rgba(255,255,255,0.6)";
    dot(g, sx, sy, 4);
    g.fill();
    if (tuned && lock > 0.98) {
      g.strokeStyle = ACCENT;
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(w - 66, py + 26, 12, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(w - 72, py + 26);
      g.lineTo(w - 67, py + 31);
      g.lineTo(w - 59, py + 21);
      g.stroke();
    }
  },
});
