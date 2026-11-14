// Shared controls in the libadwaita look of upstream: boxed-list rows, switch, toggle group,
// combo and spin rows, expander, popover menu, and the drawn TravelBar / LevelBar (levelbars.cpp).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { f, t, tc } from "../i18n/i18n";
import { Icon, type IconName } from "./icons";

const ACCENT = "#3b9cff";
const ORANGE = "255,158,51";

// ---------------------------------------------------------------- canvas helper

/** A canvas filling its parent's width at a fixed CSS height, redrawn on resize and when `deps` change. */
function useCanvas(height: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ro = new ResizeObserver(() => setWidth(c.clientWidth));
    ro.observe(c);
    setWidth(c.clientWidth);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    draw(g, width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, ...deps]);
  return ref;
}

let fontFamily = "";
/** Pango-style font ("Sans Bold 8.5" = 8.5 pt) as a canvas font, in the page's UI font. */
export const font = (pt: number, bold = false) => {
  fontFamily ||= getComputedStyle(document.documentElement).fontFamily;
  return `${bold ? "700 " : ""}${(pt * 4) / 3}px ${fontFamily || "sans-serif"}`;
};

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}
const dot = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => (g.beginPath(), g.arc(x, y, r, 0, Math.PI * 2));
/** Text with its top-left at (x, y), moved left by align × width. Returns the width. */
export function text(g: CanvasRenderingContext2D, s: string, fnt: string, x: number, y: number, align = 0, draw = true) {
  g.font = fnt;
  g.textBaseline = "top";
  g.textAlign = "left";
  const w = g.measureText(s).width;
  if (draw) g.fillText(s, x - w * align, y);
  return w;
}
const rtl = () => document.documentElement.dir === "rtl";

// ---------------------------------------------------------------- TravelBar

const SEG = 10, BAR_T = 60, BAR_B = 82, RT_T = 92, RT_B = 106;

/**
 * G HUB style press-travel bar: 10 segments from Short click to Long click. Click or drag sets the
 * click point; with rapid trigger on, dragging the orange reset band's end sets the RT level 1..5.
 */
export function TravelBar(props: { act: number; rt: number; rtOn: boolean; onChange: (act: number, rt: number) => void }) {
  const [hover, setHover] = useState(0);
  const drag = useRef<"act" | "rt" | null>(null);
  const geo = (w: number) => {
    const x0 = 10, x1 = w - 10, sw = (x1 - x0) / SEG;
    return { x0, x1, sw, ax: x0 + (props.act - 0.5) * sw };
  };
  const ref = useCanvas(130, (g, w) => {
    const { x0, x1, sw, ax } = geo(w);
    g.fillStyle = "rgb(191,194,204)";
    text(g, tc("travel bar", "Short click"), font(8.5, true), x0, 0);
    text(g, tc("travel bar", "Long click"), font(8.5, true), x1, 0, 1);
    for (let i = 1; i <= SEG; i++) {
      let a = i < props.act ? 0.1 : i === props.act ? 1 : 0.38;
      if (hover === i && i !== props.act) a = 0.65;
      g.fillStyle = i < props.act && hover !== i ? `rgba(255,255,255,${a})` : `rgba(59,156,255,${a})`;
      roundRect(g, x0 + (i - 1) * sw + 1.5, BAR_T, sw - 3, BAR_B - BAR_T, 3);
      g.fill();
    }
    g.fillStyle = "#fff";
    dot(g, ax, BAR_T - 11, 7);
    g.fill();
    g.fillStyle = ACCENT;
    dot(g, ax, BAR_T - 11, 4);
    g.fill();
    g.fillStyle = "#fff";
    g.beginPath();
    g.moveTo(ax - 5, BAR_T - 5);
    g.lineTo(ax + 5, BAR_T - 5);
    g.lineTo(ax, BAR_T);
    g.fill();
    const label = f(t("clicks at %d (≈%.1f mm)"), props.act, props.act / 10);
    g.fillStyle = ACCENT;
    const tw = text(g, label, font(8.5), 0, 0, 0, false);
    text(g, label, font(8.5), Math.min(Math.max(ax, x0 + tw / 2), Math.max(x0 + tw / 2, x1 - tw / 2)), 20, 0.5);
    if (props.rtOn) {
      const ln = props.rt * 0.6 * sw, rx = ax - ln;
      g.fillStyle = `rgba(${ORANGE},0.85)`;
      roundRect(g, rx, RT_T, ln, RT_B - RT_T, 4);
      g.fill();
      g.fillStyle = "#fff";
      dot(g, rx, (RT_T + RT_B) / 2, 6);
      g.fill();
      g.fillStyle = `rgb(${ORANGE})`;
      dot(g, rx, (RT_T + RT_B) / 2, 3.5);
      g.fill();
      g.fillStyle = "rgb(255,191,115)";
      text(g, f(t("rapid trigger: re-clicks after lifting %d/5 — drag ◀▶"), props.rt), font(8), x0, RT_B + 6);
    } else {
      g.fillStyle = "rgb(153,156,168)";
      text(g, t("rapid trigger off: re-clicks only after release past the click point"), font(8), x0, RT_T + 2);
    }
  }, [props.act, props.rt, props.rtOn, hover]);

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };
  const segAt = (x: number, w: number) => {
    const { x0, sw } = geo(w);
    return Math.min(SEG, Math.max(1, Math.floor((x - x0) / sw) + 1));
  };
  const apply = (x: number, w: number) => {
    if (drag.current === "act") {
      const a = segAt(x, w);
      if (a !== props.act) props.onChange(a, props.rt);
    } else if (drag.current === "rt") {
      const { sw, ax } = geo(w);
      const r = Math.min(5, Math.max(1, Math.round((ax - x) / (0.6 * sw))));
      if (r !== props.rt) props.onChange(props.act, r);
    }
  };
  return (
    <div className="travelbar">
      <canvas ref={ref} style={{ height: 130 }} role="slider" aria-label={t("Actuation")} aria-valuemin={1} aria-valuemax={10} aria-valuenow={props.act} tabIndex={0}
        onKeyDown={(e) => {
          const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (d) props.onChange(Math.min(SEG, Math.max(1, props.act + (rtl() ? -d : d))), props.rt);
        }}
        onPointerDown={(e) => {
          const p = local(e);
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = props.rtOn && p.y >= BAR_B + 2 ? "rt" : "act";
          apply(p.x, p.w);
        }}
        onPointerMove={(e) => {
          const p = local(e);
          if (drag.current) apply(p.x, p.w);
          setHover(p.y >= BAR_T - 30 && p.y <= BAR_B + 4 ? segAt(p.x, p.w) : 0);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => setHover(0)} />
    </div>
  );
}

// ---------------------------------------------------------------- LevelBar

const PILL_H = 28, GAP = 6, SIDE = 2;

/** Discrete level picker drawn as numbered pills (haptics 0..5, RT 1..5). Click or drag selects. */
export function LevelBar(props: { lo: number; hi: number; value: number; onChange: (v: number) => void; loText: string; hiText: string; disabled?: boolean }) {
  const [hover, setHover] = useState(-1);
  const dragging = useRef(false);
  const n = props.hi - props.lo + 1;
  const pillW = (w: number) => (w - 2 * SIDE - GAP * (n - 1)) / n;
  const at = (x: number, w: number) => Math.min(n - 1, Math.max(0, Math.floor((x - SIDE) / (pillW(w) + GAP)))) + props.lo;
  const ref = useCanvas(52, (g, w) => {
    const pw = pillW(w);
    for (let i = props.lo; i <= props.hi; i++) {
      const x = SIDE + (i - props.lo) * (pw + GAP);
      const sel = i === props.value, below = i < props.value, hov = i === hover;
      g.fillStyle = sel ? ACCENT : below ? `rgba(59,156,255,${hov ? 0.5 : 0.35})` : `rgba(255,255,255,${hov ? 0.2 : 0.1})`;
      roundRect(g, x, 0, pw, PILL_H, PILL_H / 2);
      g.fill();
      g.fillStyle = `rgba(255,255,255,${sel ? 1 : below ? 0.8 : 0.55})`;
      text(g, String(i), font(9.5, true), x + pw / 2, PILL_H / 2 - 7, 0.5);
    }
    g.fillStyle = "rgba(191,194,204,0.8)";
    text(g, props.loText, font(8.5), SIDE + 4, PILL_H + 7);
    text(g, props.hiText, font(8.5), w - SIDE - 4, PILL_H + 7, 1);
  }, [props.lo, props.hi, props.value, props.loText, props.hiText, hover]);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const v = at(e.clientX - r.left, r.width);
    if (v !== props.value) props.onChange(v);
  };
  return (
    <div className={`levelbar ${props.disabled ? "disabled" : ""}`}>
      <canvas ref={ref} style={{ height: 52 }} role="slider" aria-valuemin={props.lo} aria-valuemax={props.hi} aria-valuenow={props.value} tabIndex={props.disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (props.disabled) return;
          const d = (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) * (rtl() ? -1 : 1);
          const v = props.value + d;
          if (d && v >= props.lo && v <= props.hi) props.onChange(v);
        }}
        onPointerDown={(e) => {
          if (props.disabled) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (props.disabled) return;
          if (dragging.current) pick(e);
          const r = e.currentTarget.getBoundingClientRect();
          setHover(e.clientY - r.top <= PILL_H + 4 ? at(e.clientX - r.left, r.width) : -1);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => setHover(-1)} />
    </div>
  );
}

// ---------------------------------------------------------------- panels and boxed lists

/** AdwClamp's width for `available` px: full width up to 400, easing out to the maximum by 3 × the range. */
function clampWidth(available: number, maximum = 980, threshold = 400) {
  const amplitude = maximum - threshold;
  const upper = threshold + 3 * amplitude;
  if (available <= threshold) return available;
  if (available >= upper) return maximum;
  const progress = (available - threshold) / (upper - threshold);
  return threshold + (1 - (1 - progress) ** 3) * amplitude;
}

/** The standard page body (ui::page_column): a centred column clamped like AdwClamp. */
export function Column({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const parent = ref.current!.parentElement!;
    const observer = new ResizeObserver(() => setWidth(clampWidth(parent.clientWidth)));
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="column" style={{ maxWidth: width }}>{children}</div>;
}

export function Panel(props: { title?: string; children: ReactNode; extra?: ReactNode; className?: string }) {
  return (
    <section className={`ss-panel ${props.className ?? ""}`}>
      {(props.title || props.extra) && (
        <div className="row-head">
          {props.title && <h2 className="ss-title">{props.title}</h2>}
          {props.extra && <><span className="spacer" />{props.extra}</>}
        </div>
      )}
      {props.children}
    </section>
  );
}

export const Boxed = (props: { children: ReactNode; className?: string }) => <div className={`boxed ${props.className ?? ""}`}>{props.children}</div>;

/** AdwActionRow: title, optional subtitle, suffix widgets. Clickable when onClick is set. */
export function Row(props: {
  title: ReactNode; subtitle?: ReactNode; children?: ReactNode; onClick?: () => void; selected?: boolean;
  disabled?: boolean; chevron?: boolean; property?: boolean; tooltip?: string; prefix?: ReactNode;
}) {
  const cls = `brow ${props.selected ? "selected" : ""} ${props.disabled ? "disabled" : ""} ${props.property ? "property" : ""}`;
  const body = (
    <>
      {props.prefix}
      <span className="text">
        <span className="title">{props.title}</span>
        {props.subtitle !== undefined && props.subtitle !== "" && <span className="subtitle">{props.subtitle}</span>}
      </span>
      {(props.children || props.chevron) && (
        <span className="suffix">
          {props.children}
          {props.chevron && <Icon name="next" className="chev" />}
        </span>
      )}
    </>
  );
  if (props.onClick)
    return (
      <div className={`${cls} activatable`} role="button" tabIndex={props.disabled ? -1 : 0} title={props.tooltip}
        onClick={props.onClick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), props.onClick?.())}>
        {body}
      </div>
    );
  return <div className={cls} title={props.tooltip}>{body}</div>;
}

/** AdwButtonRow: centred label with an optional start icon. */
export function ButtonRow(props: { title: string; icon?: IconName; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="brow center" onClick={props.onClick} disabled={props.disabled}>
      {props.icon && <Icon name={props.icon} />}
      {props.title}
    </button>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <span className="switch" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" role="switch" aria-label={props.label} checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span />
    </span>
  );
}

/** AdwSwitchRow: the whole row toggles the switch. */
export function SwitchRow(props: { title: string; subtitle?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Row title={props.title} subtitle={props.subtitle} disabled={props.disabled} onClick={() => props.onChange(!props.checked)}>
      <Switch checked={props.checked} onChange={props.onChange} disabled={props.disabled} label={props.title} />
    </Row>
  );
}

/** AdwComboRow: the current value and a chevron; a native list opens on click. `search` opens a filterable list instead. */
export function ComboRow<T extends string | number>(props: {
  title: string; subtitle?: string; value: T; options: { value: T; label: string; lang?: string }[]; onChange: (v: T) => void; disabled?: boolean; search?: boolean;
}) {
  const id = useRef(`c${Math.random().toString(36).slice(2)}`).current;
  if (props.search) return <SearchComboRow {...props} />;
  return (
    <Row title={<label htmlFor={id}>{props.title}</label>} subtitle={props.subtitle} disabled={props.disabled}>
      <Combo id={id} value={props.value} options={props.options} onChange={props.onChange} disabled={props.disabled} label={props.title} />
    </Row>
  );
}

function SearchComboRow<T extends string | number>(props: {
  title: string; subtitle?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, host, close);
  const cur = props.options.find((o) => o.value === props.value);
  const q = query.trim().toLowerCase();
  const shown = q ? props.options.filter((o) => o.label.toLowerCase().includes(q)) : props.options;
  const pick = (v: T) => {
    setOpen(false);
    if (v !== props.value) props.onChange(v);
  };
  return (
    <div className="popover-anchor block" ref={host}>
      <Row title={props.title} subtitle={props.subtitle} disabled={props.disabled} onClick={() => (setQuery(""), setOpen(!open))}>
        <span className="combo-value">{cur?.label ?? ""}</span>
        <Icon name="down" />
      </Row>
      {open && (
        <div className="popover list search" role="listbox">
          <input autoFocus placeholder={t("Search")} value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && shown[0] && pick(shown[0].value)} />
          <div className="items">
            {shown.map((o) => (
              <button key={String(o.value)} role="option" aria-selected={o.value === props.value} onClick={() => pick(o.value)}>
                <span className="label">{o.label}</span>
                {o.value === props.value && <Icon name="check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Combo<T extends string | number>(props: { id?: string; value: T; options: { value: T; label: string; lang?: string }[]; onChange: (v: T) => void; disabled?: boolean; label?: string }) {
  const numeric = typeof props.value === "number";
  return (
    <span className="combo">
      <select id={props.id} value={String(props.value)} disabled={props.disabled} aria-label={props.label}
        onChange={(e) => props.onChange((numeric ? Number(e.target.value) : e.target.value) as T)}>
        {props.options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} lang={o.lang}>{o.label}</option>
        ))}
      </select>
      <Icon name="down" />
    </span>
  );
}

/**
 * AdwSpinRow: number with − / +. Typing commits after a short pause (when the number is in range), on
 * Enter or on blur, so "1600" does not send 1, 16, 160 first.
 * `step` moves from the current value; onCommit gets the clamped new value and the old one.
 */
export function SpinRow(props: { title: string; subtitle?: string; value: number; min: number; max: number; step: number; onCommit: (v: number, prev: number) => void; disabled?: boolean }) {
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(pause.current), []);
  const commit = (v: number) => {
    clearTimeout(pause.current);
    const c = Math.min(props.max, Math.max(props.min, Math.round(v)));
    if (c !== props.value) props.onCommit(c, props.value);
  };
  return (
    <Row title={props.title} subtitle={props.subtitle} disabled={props.disabled}>
      <span className="spin">
        <input key={props.value} type="number" inputMode="numeric" defaultValue={props.value} min={props.min} max={props.max} step={props.step} aria-label={props.title} disabled={props.disabled}
          onInput={(e) => {
            const v = e.currentTarget.valueAsNumber;
            clearTimeout(pause.current);
            if (Number.isFinite(v) && v >= props.min && v <= props.max) pause.current = setTimeout(() => commit(v), 700);
          }}
          onBlur={(e) => (Number.isFinite(+e.currentTarget.value) ? commit(+e.currentTarget.value) : (e.currentTarget.value = String(props.value)))}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
        <button aria-label="−" disabled={props.disabled || props.value <= props.min} onClick={() => commit(props.value - props.step)}><Icon name="minus" /></button>
        <button aria-label="+" disabled={props.disabled || props.value >= props.max} onClick={() => commit(props.value + props.step)}><Icon name="plus" /></button>
      </span>
    </Row>
  );
}

/** AdwExpanderRow: a row that shows its child rows when opened. */
export function ExpanderRow(props: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`brow activatable expander-head ${open ? "open" : ""}`} role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen(!open)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(!open))}>
        <span className="text">
          <span className="title">{props.title}</span>
          {props.subtitle && <span className="subtitle">{props.subtitle}</span>}
        </span>
        <span className="suffix"><Icon name="down" className="chev" /></span>
      </div>
      {open && <div className="expander-body">{props.children}</div>}
    </>
  );
}

/** AdwToggleGroup. `wide` stretches the toggles to the full width (homogeneous). */
export function Toggles<T extends string | number>(props: { options: { value: T; label: string; disabled?: boolean }[]; value: T | null; onChange: (v: T) => void; wide?: boolean; title?: string }) {
  return (
    <div className={`toggles ${props.wide ? "wide" : ""}`} role="radiogroup" title={props.title}>
      {props.options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === props.value} className={o.value === props.value ? "on" : ""} disabled={o.disabled}
          onClick={() => o.value !== props.value && props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Flat icon button that opens a popover menu below it. Items close the menu. */
export function MenuButton(props: { icon: IconName; tooltip: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLSpanElement>(null);
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, host, close);
  return (
    <span className="popover-anchor" ref={host}>
      <button className={`flat icon ${open ? "active" : ""}`} title={props.tooltip} aria-label={props.tooltip} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={props.icon} />
      </button>
      {open && <div className="popover" role="menu">{props.children(() => setOpen(false))}</div>}
    </span>
  );
}

/** Closes an open popover on a click outside `host` or Escape. */
function useDismiss(open: boolean, host: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => host.current && !host.current.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, host, close]);
}

/** GtkDropDown: a button with the selected label and a list popover with a check on the selection. */
export function Dropdown<T extends string | number>(props: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; tooltip?: string; up?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLSpanElement>(null);
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, host, close);
  const cur = props.options.find((o) => o.value === props.value);
  return (
    <span className={`dropdown popover-anchor ${props.className ?? ""}`} ref={host}>
      <button className={open ? "active" : ""} disabled={props.disabled} title={props.tooltip} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="label">{cur?.label ?? "—"}</span>
        <Icon name="down" />
      </button>
      {open && (
        <div className={`popover list ${props.up ? "up" : ""}`} role="listbox">
          {props.options.map((o) => (
            <button key={String(o.value)} role="option" aria-selected={o.value === props.value} onClick={() => (setOpen(false), o.value !== props.value && props.onChange(o.value))}>
              <span className="label">{o.label}</span>
              {o.value === props.value && <Icon name="check" />}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function IconButton(props: { icon: IconName; tooltip: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="flat icon" title={props.tooltip} aria-label={props.tooltip} onClick={(e) => (e.stopPropagation(), props.onClick())} disabled={props.disabled}>
      <Icon name={props.icon} />
    </button>
  );
}
