import { ACCENT, clear, cursor, ease, monitor, mouse, mouseW, rgba, seg } from "./engine";
import { scene } from "./scene";

const MAX_DPI = 3200;

/**
 * The same short hand move at `dpi`: the cursor travels a distance set by the DPI, and a ruler under the
 * screen shows how far it went. `marks` adds ticks for other DPI values to compare with.
 */
export const speed = scene<{ dpi: number; marks?: number[] }>({
  duration: 3,
  still: 1.35,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    const hand = t < 0.25 ? 0 : t < 1.25 ? ease(seg(t, 0.25, 1.25)) : t < 2.2 ? 1 : 1 - ease(seg(t, 2.2, 2.85));
    const sx = 64, sw = w - 128, x0 = sx + 22, reach = sw - 44, y = 98;
    const k = Math.min(1, Math.max(0.05, v.dpi / MAX_DPI));
    clear(g, w, h);
    monitor(g, sx, 22, sw, 150);
    // ruler: the full width is the most DPI shown, ticks for the other choices
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, 152);
    g.lineTo(x0 + reach, 152);
    g.stroke();
    for (const m of v.marks ?? []) {
      const mx = x0 + reach * Math.min(1, m / MAX_DPI);
      g.beginPath();
      g.moveTo(mx, 146);
      g.lineTo(mx, 158);
      g.stroke();
    }
    const cx = x0 + reach * k * hand;
    g.strokeStyle = rgba(ACCENT, 0.9);
    g.lineWidth = 4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x0, 152);
    g.lineTo(Math.max(x0 + 1, cx), 152);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(x0 - 1, 84, 2, 28);
    cursor(g, cx, y);
    g.font = "800 15px system-ui, sans-serif";
    g.fillStyle = ACCENT;
    g.textAlign = "center";
    g.fillText(`${v.dpi} DPI`, Math.min(sx + sw - 40, Math.max(sx + 40, x0 + reach * k)), 52);
    g.textAlign = "start";
    // the hand: the mouse moves the same short way every time
    const mh = 130, mw = mouseW(mh);
    mouse(g, w / 2 - mw / 2 - 40 + hand * 80, 200, mh);
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.setLineDash([4, 5]);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(w / 2 - 40, 340);
    g.lineTo(w / 2 + 40, 340);
    g.stroke();
    g.setLineDash([]);
  },
});
