// Small shared controls: level pills, press-travel bar, toggles, panels.
import { useRef, type ReactNode } from "react";
import { tc } from "../i18n/i18n";

/** Discrete level picker drawn as pills. Click or drag to select. */
export function LevelBar(props: { lo: number; hi: number; value: number; onChange: (v: number) => void; loText: string; hiText: string; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const levels = Array.from({ length: props.hi - props.lo + 1 }, (_, i) => props.lo + i);
  const pick = (e: React.PointerEvent) => {
    if (props.disabled || !ref.current || (e.type === "pointermove" && !e.buttons)) return;
    const r = ref.current.getBoundingClientRect();
    const i = Math.min(levels.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * levels.length)));
    if (levels[i] !== props.value) props.onChange(levels[i]);
  };
  return (
    <div className={`levelbar ${props.disabled ? "disabled" : ""}`}>
      <div className="pills" ref={ref} onPointerDown={pick} onPointerMove={pick} role="slider" aria-valuemin={props.lo} aria-valuemax={props.hi} aria-valuenow={props.value} tabIndex={0}
        onKeyDown={(e) => {
          if (props.disabled) return;
          if (e.key === "ArrowRight" && props.value < props.hi) props.onChange(props.value + 1);
          if (e.key === "ArrowLeft" && props.value > props.lo) props.onChange(props.value - 1);
        }}>
        {levels.map((v) => (
          <span key={v} className={v <= props.value && v > 0 ? "on" : ""} />
        ))}
      </div>
      <div className="ends">
        <span>{props.loText}</span>
        <span>{props.hiText}</span>
      </div>
    </div>
  );
}

/** G HUB style press travel: 10 segments from short to long click. The orange band is the rapid trigger reset distance. */
export function TravelBar(props: { act: number; rt: number; rtOn: boolean; onChange: (act: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const pick = (e: React.PointerEvent) => {
    if (!ref.current || (e.type === "pointermove" && !e.buttons)) return;
    const r = ref.current.getBoundingClientRect();
    const v = Math.min(10, Math.max(1, Math.ceil(((e.clientX - r.left) / r.width) * 10)));
    if (v !== props.act) props.onChange(v);
  };
  return (
    <div className="travel">
      <div className="segments" ref={ref} onPointerDown={pick} onPointerMove={pick}>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const reset = props.rtOn && n <= props.act && n > props.act - props.rt;
          return <span key={n} className={`${n <= props.act ? "on" : ""} ${reset ? "reset" : ""} ${n === props.act ? "point" : ""}`} />;
        })}
      </div>
      <div className="ends">
        <span>{tc("travel bar", "Short click")}</span>
        <span>{tc("travel bar", "Long click")}</span>
      </div>
    </div>
  );
}

export function Toggles<T extends string | number>(props: { options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="toggles" role="radiogroup">
      {props.options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === props.value} className={o.value === props.value ? "on" : ""} disabled={o.disabled} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel(props: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="panel">
      <header>
        <h2>{props.title}</h2>
        {props.extra}
      </header>
      {props.children}
    </section>
  );
}

export function Row(props: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <div>{props.title}</div>
        {props.subtitle && <small>{props.subtitle}</small>}
      </div>
      <div className="row-control">{props.children}</div>
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={props.label} checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span />
    </label>
  );
}

/** Number field that commits on blur / Enter, so typing "1600" does not send 1, 16, 160 first. */
export function NumberField(props: { value: number; min: number; max: number; step?: number; onCommit: (v: number) => void; disabled?: boolean; label?: string }) {
  const commit = (el: HTMLInputElement) => {
    const v = Math.round(Number(el.value));
    if (!Number.isFinite(v)) return void (el.value = String(props.value));
    const c = Math.min(props.max, Math.max(props.min, v));
    el.value = String(c);
    if (c !== props.value) props.onCommit(c);
  };
  return (
    <input
      key={props.value}
      type="number"
      aria-label={props.label}
      defaultValue={props.value}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      disabled={props.disabled}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget)}
    />
  );
}
