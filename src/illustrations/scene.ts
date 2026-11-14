import type { G } from "./engine";

/** An animation of what a setting does, drawn for the value(s) it is given. */
export interface Scene<V> {
  /** loop length in seconds */
  duration: number;
  /** the moment that best shows the setting, drawn when motion is reduced */
  still: number;
  size: (v: V) => [number, number];
  draw: (g: G, t: number, v: V, w: number, h: number) => void;
}

export const scene = <V>(s: Scene<V>) => s;

/** Column centres for n mice side by side. */
export const columns = (n: number, w: number) => Array.from({ length: n }, (_, i) => (w * (i + 0.5)) / n);
