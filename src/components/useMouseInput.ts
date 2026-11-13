// Live mouse input from the page: which buttons are held, and wheel steps.
import { useEffect, useState } from "react";
import type { Zone } from "../model/tables";

// MouseEvent.button -> zone
export const BUTTON_ZONE: Record<number, Zone> = { 0: "btn-left", 1: "btn-middle", 2: "btn-right", 3: "btn-back", 4: "btn-forward" };

// The side buttons would otherwise make the browser go back / forward and leave the app.
if (typeof window !== "undefined") {
  for (const type of ["mouseup", "mousedown", "auxclick"] as const)
    window.addEventListener(type, (e) => {
      if (e.button === 3 || e.button === 4) e.preventDefault();
    });
}

export function useMouseInput() {
  const [pressed, setPressed] = useState<ReadonlySet<string>>(new Set());
  const [wheelTick, setWheelTick] = useState(0);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const z = BUTTON_ZONE[e.button];
      if (z) setPressed((s) => new Set(s).add(z));
    };
    const up = (e: PointerEvent) => {
      const z = BUTTON_ZONE[e.button];
      if (z)
        setPressed((s) => {
          const n = new Set(s);
          n.delete(z);
          return n;
        });
    };
    const clear = () => setPressed(new Set());
    const wheel = () => setWheelTick((t) => t + 1);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("blur", clear);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("blur", clear);
      window.removeEventListener("wheel", wheel);
    };
  }, []);
  return { pressed, wheelTick };
}
