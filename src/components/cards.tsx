// Setting cards: the illustration of what the setting does on top, the control underneath.
import type { ReactNode } from "react";
import { t } from "../i18n/i18n";
import { Illustration } from "../illustrations/Illustration";
import type { SceneName, SceneValue } from "../illustrations";
import { Icon, type IconName } from "./icons";

/**
 * One setting: its animation on top (when it has one), then the icon, title and current value, then the
 * controls. `live` marks a setting that the mouse takes at once, which never counts as unsaved.
 */
export function FxCard<N extends SceneName>(props: {
  title: string; icon?: IconName; value?: ReactNode; scene?: N; sceneValue?: SceneValue<N>; className?: string; tall?: boolean; live?: boolean; children?: ReactNode;
}) {
  return (
    <section className={`fx-card ${props.className ?? ""}`}>
      {props.scene && props.sceneValue && (
        <div className={`fx-art ${props.tall ? "tall" : ""}`}>
          <Illustration scene={props.scene} value={props.sceneValue} label={props.title} />
        </div>
      )}
      <div className="fx-body">
        <div className="fx-head">
          {props.icon && <Icon name={props.icon} />}
          <h3>{props.title}</h3>
          {props.live && <span className="ss-badge live" title={t("Applies at once. Device setting, not per profile")}>{t("Applies at once")}</span>}
          {props.value !== undefined && <span className="fx-value">{props.value}</span>}
        </div>
        {props.children}
      </div>
    </section>
  );
}

/** One choice of a few, as a row of buttons. */
export function Segments<T extends string | number>(props: { options: { value: T; label: string; disabled?: boolean }[]; value: T | null; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="segments" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === props.value} className={o.value === props.value ? "on" : ""} disabled={o.disabled}
          onClick={() => o.value !== props.value && props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A slider over whole steps lo..hi with a word at each end. */
export function Steps(props: { lo: number; hi: number; value: number; onChange: (v: number) => void; loText: string; hiText: string; label: string; disabled?: boolean }) {
  return (
    <div className="steps">
      <input type="range" min={props.lo} max={props.hi} step={1} value={props.value} disabled={props.disabled} aria-label={props.label}
        onChange={(e) => +e.target.value !== props.value && props.onChange(+e.target.value)} />
      <div className="ends"><span>{props.loText}</span><span>{props.hiText}</span></div>
    </div>
  );
}
