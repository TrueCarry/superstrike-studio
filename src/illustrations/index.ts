// Every illustration by name. The README animations (tools/readme) and the app draw from these.
import { actuation } from "./actuation";
import { dpi } from "./dpi";
import { feel } from "./feel";
import { haptics } from "./haptics";
import { hero } from "./hero";
import { lod } from "./lod";
import { polling } from "./polling";
import { power } from "./power";
import { profiles } from "./profiles";
import { rapid } from "./rapid";
import { remap } from "./remap";
import { save } from "./save";
import { scroll } from "./scroll";
import { snap } from "./snap";
import { speed } from "./speed";
import { surface } from "./surface";

export const SCENES = { hero, actuation, rapid, haptics, polling, dpi, remap, profiles, snap, lod, feel, speed, surface, scroll, power, save };
export type SceneName = keyof typeof SCENES;
export type SceneValue<N extends SceneName> = Parameters<(typeof SCENES)[N]["draw"]>[2];

/** What the README shows: shallow vs deep, off vs on, and so on. */
export const README: { [N in Exclude<SceneName, "feel">]: SceneValue<N> } = {
  speed: { dpi: 1600, marks: [400, 800, 1600, 3200] },
  surface: { mode: 1 },
  scroll: { ms: 100 },
  power: { low: 60, sleep: 300 },
  save: { act: 3, dpi: 1600, hap: 2 },
  hero: {},
  actuation: { act: [2, 9] },
  rapid: { rt: [0, 2] },
  haptics: {},
  polling: { rate: [0, 6] },
  dpi: { ratio: 0.2 },
  remap: { steps: [["btn-middle", "sensor"], ["btn-forward", "media"], ["btn-back", "copy"]] },
  profiles: {},
  snap: { on: [false, true] },
  lod: { level: [3, 1] },
};
