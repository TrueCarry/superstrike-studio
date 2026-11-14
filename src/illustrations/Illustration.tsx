import { useEffect, useRef } from "react";
import { SCENES, type SceneName, type SceneValue } from "./index";
import type { Scene } from "./scene";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * An illustration drawn for `value`, filling its width. It plays only while on screen and shows its
 * still frame when the system asks for reduced motion.
 */
export function Illustration<N extends SceneName>(props: { scene: N; value: SceneValue<N>; label?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const value = useRef(props.value);
  value.current = props.value;
  const key = JSON.stringify(props.value);
  const sc = SCENES[props.scene] as unknown as Scene<SceneValue<N>>;
  const [w, h] = sc.size(props.value);

  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext("2d")!;
    const draw = (t: number) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      sc.draw(g, t, value.current, w, h);
    };
    if (reducedMotion()) {
      draw(sc.still);
      return;
    }
    let raf = 0, t0 = performance.now(), visible = false;
    const tick = (now: number) => {
      draw(((now - t0) / 1000) % sc.duration);
      raf = visible ? requestAnimationFrame(tick) : 0;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        t0 = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    draw(sc.still);
    io.observe(c);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [sc, w, h, key]);

  return <canvas ref={ref} className={`illustration ${props.className ?? ""}`} style={{ aspectRatio: `${w} / ${h}` }} role="img" aria-label={props.label} />;
}
