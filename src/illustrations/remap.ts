import { ACCENT, clamp, clear, callout, mouse, seg } from "./engine";
import { picture } from "./picture";
import { scene } from "./scene";

/** Side buttons pressed in turn, each showing its action's icon in a callout. `steps` = [zone, icon]. */
export const remap = scene<{ steps: [string, string][] }>({
  duration: 3.3,
  still: 0.65,
  size: () => [480, 360],
  draw(g, t, v, w, h) {
    clear(g, w, h);
    const ph = 320, x = 96, y = 18, P = 3 / v.steps.length;
    const k = Math.min(v.steps.length - 1, Math.floor(Math.max(0, t - 0.3) / P)), s0 = 0.3 + k * P, age = t - s0;
    const zone = v.steps[k][0];
    mouse(g, x, y, ph, {
      view: "side", zone, press: age >= 0 && age < 0.25 ? 1 : 0, glow: age >= 0 ? clamp(1 - (age - 0.25) / 0.3) : 0,
      ripples: age >= 0 ? [[age, ACCENT]] : [],
    });
    const fade = 1 - seg(age, P - 0.3, P - 0.1);
    if (age < 0 || fade <= 0) return;
    const z = picture("side").zones.get(zone)!, s = ph / picture("side").h, zy = y + z.cy * s;
    g.globalAlpha = fade;
    callout(g, x + z.cx * s, zy, 330, zy, 66, v.steps[k][1], age / 0.25);
    g.globalAlpha = 1;
  },
});
