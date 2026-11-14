import { ACCENT, clear, cursor, dot, ease, monitor, rgba, seg } from "./engine";
import { outline, picture } from "./picture";
import { columns, scene } from "./scene";

/**
 * Lift the mouse to reposition it, twice. The dashed line is how high the sensor still tracks
 * (`level` 1 low .. 3 high): below it the cursor follows the mouse back, above it the cursor stays put.
 */
export const lod = scene<{ level: number[] }>({
  duration: 3.6,
  still: 1.2,
  size: (v) => [240 * v.level.length, 360],
  draw(g, t, v, w, h) {
    const P = 1.5;
    const phase = (q: number) => (Math.min(q, 2 * P - 1e-6) % P) / P;
    const slideOf = (q: number) => {
      const u = phase(q);
      return u < 0.45 ? ease(u / 0.45) : u < 0.55 ? 1 : u < 0.92 ? 1 - ease((u - 0.55) / 0.37) : 0;
    };
    const liftOf = (q: number) => {
      const u = phase(q);
      return u < 0.45 ? 0 : u < 0.55 ? ease((u - 0.45) / 0.1) : u < 0.86 ? 1 : u < 0.95 ? 1 - ease((u - 0.86) / 0.09) : 0;
    };
    const slide = slideOf(t), lift = liftOf(t), fade = 1 - seg(t, 3.25, 3.6);
    clear(g, w, h);
    columns(v.level.length, w).forEach((cx, i) => {
      const reach = [0.2, 0.5, 0.9][Math.min(2, Math.max(0, v.level[i] - 1))];
      monitor(g, cx - 100, 22, 200, 130);
      const desk = 318, liftPx = 40, s = 0.16, mw = 976 * s, high = 0.6;
      const sees = (q: number) => liftOf(q) * high < reach;
      let pos = 0;
      for (let q = 0.01; q <= t; q += 0.01) if (sees(q)) pos += slideOf(q) - slideOf(q - 0.01);
      g.globalAlpha = fade;
      cursor(g, cx - 70 + pos * 70, 80);
      g.globalAlpha = 1;
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fillRect(cx - 110, desk, 220, 3);
      const ly = desk - reach * liftPx;
      g.strokeStyle = rgba(ACCENT, 0.85);
      g.setLineDash([6, 5]);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 110, ly);
      g.lineTo(cx + 110, ly);
      g.stroke();
      g.setLineDash([]);
      const mx = cx - mw / 2 - 30 + slide * 60, my = desk - lift * high * liftPx;
      g.fillStyle = `rgba(0,0,0,${0.35 * (1 - lift * 0.6)})`;
      g.beginPath();
      g.ellipse(mx + mw / 2, desk + 1, mw * 0.45 * (1 - lift * 0.15), 4, 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(mx, my);
      g.rotate(-Math.PI / 2);
      g.scale(s, s);
      g.translate(-12, -12);
      outline(g, picture("side"));
      g.restore();
      g.fillStyle = sees(t) ? ACCENT : "rgba(255,255,255,0.2)";
      dot(g, mx + 480 * s, my + 2, 4);
      g.fill();
    });
  },
});
