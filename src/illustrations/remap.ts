import { ACCENT, ORANGE, clamp, clear, callout, mouse, seg } from "./engine";
import { picture, type View } from "./picture";
import { scene } from "./scene";

/**
 * Buttons pressed in turn, each showing its action's icon in a callout. `steps` = [zone, icon]; the side
 * view unless a button is only on top. `hold` keeps that button held down (the DPI shift button) while
 * the steps play, and the callouts turn orange: the second actions of the DPI-shift layer.
 */
export const remap = scene<{ steps: [string, string][]; hold?: string }>({
  duration: 3.3,
  still: 0.65,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    clear(g, w, h);
    const zones = [...v.steps.map(([z]) => z), ...(v.hold ? [v.hold] : [])];
    const view: View = zones.every((z) => picture("side").zones.has(z)) ? "side" : "top";
    const pic = picture(view), ph = 320, s = ph / pic.h, x = view === "side" ? 96 : 120, y = 18, P = 3 / v.steps.length;
    const k = Math.min(v.steps.length - 1, Math.floor(Math.max(0, t - 0.3) / P)), age = t - (0.3 + k * P);
    const zone = v.steps[k][0], color = v.hold ? ORANGE : ACCENT;
    mouse(g, x, y, ph, {
      view, zone, press: age >= 0 && age < 0.25 ? 1 : 0, glow: age >= 0 ? clamp(1 - (age - 0.25) / 0.3) : 0,
      ripples: age >= 0 ? [[age, color]] : [], held: v.hold && v.hold !== zone ? [v.hold] : [],
    });
    const fade = 1 - seg(age, P - 0.3, P - 0.1);
    const z = pic.zones.get(zone);
    if (age < 0 || fade <= 0 || !z) return;
    const zy = y + z.cy * s;
    g.globalAlpha = fade;
    callout(g, x + z.cx * s, zy, 330, zy, 66, v.steps[k][1], age / 0.25, color);
    g.globalAlpha = 1;
  },
});
