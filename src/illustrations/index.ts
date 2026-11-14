// Every illustration by name. The README animations (tools/readme) and the app draw from these.
import { actuation } from "./actuation";
import { dpi } from "./dpi";
import { feel } from "./feel";
import { haptics } from "./haptics";
import { hero } from "./hero";
import { lod } from "./lod";
import { polling } from "./polling";
import { profiles } from "./profiles";
import { rapid } from "./rapid";
import { remap } from "./remap";
import { snap } from "./snap";

export const SCENES = { hero, actuation, rapid, haptics, polling, dpi, remap, profiles, snap, lod, feel };
export type SceneName = keyof typeof SCENES;
export type SceneValue<N extends SceneName> = Parameters<(typeof SCENES)[N]["draw"]>[2];

/** What the README shows: shallow vs deep, off vs on, and so on. */
export const README: { [N in Exclude<SceneName, "feel">]: SceneValue<N> } = {
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
