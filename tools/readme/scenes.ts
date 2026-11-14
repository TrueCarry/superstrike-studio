// window.scenes lists every illustration with its length and size; window.render(name, t) draws it at
// t seconds with the README values and returns the RGBA pixels as base64.
import { README, SCENES, type SceneName } from "../../src/illustrations";
import type { Scene } from "../../src/illustrations/scene";

const c = document.getElementById("c") as HTMLCanvasElement;
const g = c.getContext("2d", { willReadFrequently: true })!;
const get = (name: string) => [SCENES[name as SceneName] as unknown as Scene<unknown>, README[name as SceneName]] as const;

Object.assign(window, {
  scenes: Object.fromEntries(Object.keys(SCENES).map((n) => {
    const [s, v] = get(n);
    return [n, { duration: s.duration, size: s.size(v) }];
  })),
  render(name: string, t: number) {
    const [s, v] = get(name), [w, h] = s.size(v);
    if (c.width !== w || c.height !== h) [c.width, c.height] = [w, h];
    g.setTransform(1, 0, 0, 1, 0, 0);
    s.draw(g, t, v, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let out = "";
    for (let i = 0; i < d.length; i += 0x8000) out += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000) as unknown as number[]);
    return btoa(out);
  },
});
