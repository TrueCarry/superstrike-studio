import { ACCENT, ORANGE, clamp, clear, ease, icon, monitor, mouse, mouseW, rgba, seg } from "./engine";
import { scene } from "./scene";

/**
 * Saving into the mouse: the chosen settings (click point `act`, `dpi`, haptics `hap`) fly into the mouse
 * and its memory fills; then the mouse moves to a second computer and keeps them.
 */
export const save = scene<{ act: number; dpi: number; hap: number }>({
  duration: 4.4,
  still: 2.2,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    clear(g, w, h);
    const move = ease(seg(t, 2.3, 3.0)); // the mouse goes from the first computer to the second
    const fade = 1 - seg(t, 4.1, 4.4);
    // two computers: this one with the app, another one without it
    const pcA = 30, pcB = w - 30 - 150, pcY = 30;
    g.globalAlpha = 1 - 0.6 * move;
    monitor(g, pcA, pcY, 150, 100);
    g.fillStyle = rgba(ACCENT, 0.8);
    g.beginPath();
    g.roundRect(pcA + 12, pcY + 12, 50, 8, 4);
    g.fill();
    g.globalAlpha = 0.4 + 0.6 * move;
    monitor(g, pcB, pcY, 150, 100);
    g.globalAlpha = 1;
    // the chips: settings flying from the app into the mouse
    const chips: [string, string, string][] = [["actuation", String(v.act), ACCENT], ["sensor", `${v.dpi}`, ACCENT], ["haptics", String(v.hap), ORANGE]];
    const mh = 170, mw = mouseW(mh), mx = 60 + move * (w - 120 - mw), my = 170;
    chips.forEach(([name, text], i) => {
      const u = ease(seg(t, 0.3 + i * 0.25, 1.0 + i * 0.25));
      if (u <= 0 || u >= 1) return;
      const sx = pcA + 30 + i * 40, sy = pcY + 60, ex = mx + mw / 2, ey = my + mh * 0.45;
      const x = sx + (ex - sx) * u, y = sy + (ey - sy) * u - Math.sin(u * Math.PI) * 40;
      g.globalAlpha = 1 - seg(u, 0.85, 1);
      g.fillStyle = "rgb(31,31,36)";
      g.strokeStyle = chips[i][2];
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(x - 34, y - 14, 68, 28, 14);
      g.fill();
      g.stroke();
      icon(g, name, x - 26, y - 7, 14, chips[i][2]);
      g.font = "800 13px system-ui, sans-serif";
      g.fillStyle = "#fff";
      g.fillText(text, x - 8, y + 5);
      g.globalAlpha = 1;
    });
    // the mouse with its memory filling
    const fill = clamp(seg(t, 0.6, 1.9));
    const glow = t > 3.0 ? Math.sin(seg(t, 3.0, 3.6) * Math.PI) : 0;
    mouse(g, mx, my, mh, { glow: glow * 0.8 });
    const bx = mx + mw + 14, by = my + 30, bh = 100;
    g.fillStyle = "rgba(255,255,255,0.1)";
    g.beginPath();
    g.roundRect(bx, by, 14, bh, 7);
    g.fill();
    g.fillStyle = ACCENT;
    g.beginPath();
    g.roundRect(bx, by + bh * (1 - fill), 14, Math.max(6, bh * fill), 7);
    g.fill();
    // the cable to the second computer, then a check: same feel there
    if (move > 0.98) {
      const k = seg(t, 3.0, 3.3);
      g.strokeStyle = rgba(ACCENT, 0.7 * fade);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(mx + mw / 2, my);
      g.quadraticCurveTo(mx + mw / 2, pcY + 150, mx + mw / 2 + (pcB + 75 - mx - mw / 2) * k, pcY + 108);
      g.stroke();
      if (k >= 1) {
        g.globalAlpha = fade;
        chips.forEach(([name, text, color], i) => {
          const y = pcY + 18 + i * 26;
          icon(g, name, pcB + 16, y, 14, color);
          g.font = "800 13px system-ui, sans-serif";
          g.fillStyle = "#fff";
          g.fillText(text, pcB + 38, y + 12);
        });
        g.strokeStyle = "#3ddc84";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(pcB + 112, pcY + 50);
        g.lineTo(pcB + 120, pcY + 58);
        g.lineTo(pcB + 134, pcY + 42);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
  },
});
