// Quick setup for a new mouse: pick a click feel by its animation, pick a speed, save. It writes through
// the same store actions as the panels, so everything can be refined afterwards.
import { useEffect, useState } from "react";
import { f, t } from "../i18n/i18n";
import { Illustration } from "../illustrations/Illustration";
import { BUILTIN_PRESETS, hitsCodeDecode } from "../model/profile";
import { commit } from "../state/hits";
import { currentProfile, getState, save, updateProfile, useStore } from "../state/store";
import { setStudio, useStudio } from "../state/studio";

const DONE_KEY = "superstrike.setup";
const FEELS = [
  { preset: "Fast FPS", title: "Light and fast", hint: "Shallow click and rapid trigger, for shooters." },
  { preset: "Balanced", title: "Balanced", hint: "The factory feel, good for everything." },
  { preset: "Deep press", title: "Deep and deliberate", hint: "A long press and a firm click, fewer misclicks." },
];
const SPEEDS = [400, 800, 1600, 3200];

const feelHits = (name: string) => {
  const v = hitsCodeDecode(BUILTIN_PRESETS.find((p) => p.name === name)!.code);
  return typeof v === "string" ? null : v;
};

/** Opens quick setup once, the first time a mouse connects in this browser. */
export function useFirstConnectSetup() {
  const ready = useStore((s) => s.status === "connected" && s.edit >= 0);
  useEffect(() => {
    if (!ready || localStorage.getItem(DONE_KEY) || new URLSearchParams(location.search).has("shot")) return;
    localStorage.setItem(DONE_KEY, "1");
    setStudio({ setup: true });
  }, [ready]);
}

export function QuickSetup() {
  const open = useStudio((s) => s.setup);
  const profile = useStore(currentProfile);
  const dpiList = useStore((s) => s.info?.dpiList ?? []);
  const [step, setStep] = useState(0);
  const [feel, setFeel] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setFeel(null);
    setSpeed(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setStudio({ setup: false });
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!open || !profile) return null;

  const close = () => setStudio({ setup: false });
  const pickFeel = (name: string) => {
    const v = feelHits(name);
    if (v) commit(v);
    setFeel(name);
  };
  const pickSpeed = (dpi: number) => {
    const v = dpiList.length ? dpiList.reduce((a, b) => (Math.abs(b - dpi) < Math.abs(a - dpi) ? b : a)) : dpi;
    updateProfile((p) => {
      const i = p.stages[p.defaultStage]?.x ? p.defaultStage : 0;
      p.stages[i] = { ...p.stages[i], x: v, y: v, lod: p.stages[i].lod || 2 };
    });
    setSpeed(dpi);
  };
  const finish = async () => {
    await save();
    if (!getState().dirty.length) close();
  };
  const STEPS = [t("Click feel"), t("Speed"), t("Save")];

  return (
    <div className="setup-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="setup" role="dialog" aria-modal="true" aria-label={t("Quick setup")}>
        <header>
          <h2>{t("Quick setup")}</h2>
          <ol className="setup-steps">
            {STEPS.map((s, i) => <li key={s} className={i === step ? "on" : i < step ? "done" : ""}>{s}</li>)}
          </ol>
          <button className="flat" onClick={close}>{t("Skip")}</button>
        </header>

        {step === 0 && (
          <>
            <p className="lead">{t("How should a click feel? Pick the one you like.")}</p>
            <div className="setup-choices">
              {FEELS.map((c) => {
                const h = feelHits(c.preset)![0];
                return (
                  <button key={c.preset} className={`setup-choice ${feel === c.preset ? "on" : ""}`} aria-pressed={feel === c.preset} onClick={() => pickFeel(c.preset)}>
                    <Illustration scene="feel" value={{ act: h.act, rt: h.rtOn ? h.rt : 0, hap: h.hap }} label={t(c.title)} />
                    <b>{t(c.title)}</b>
                    <span className="ss-hint">{t(c.hint)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="lead">{t("How far should the cursor go for the same hand move?")}</p>
            <div className="setup-speed">
              <Illustration scene="dpi" value={{ ratio: (speed ?? 800) / 3200 }} label={t("Speed")} />
              <div className="segments" role="radiogroup" aria-label={t("Speed")}>
                {SPEEDS.map((d) => (
                  <button key={d} role="radio" aria-checked={speed === d} className={speed === d ? "on" : ""} onClick={() => pickSpeed(d)}>
                    {d} DPI
                  </button>
                ))}
              </div>
              <span className="ss-hint">{t("Low DPI for precise aim in shooters, high DPI for big screens and the desktop.")}</span>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="setup-save">
            <Illustration scene="hero" value={{}} label={t("Save to mouse")} />
            <p className="lead">{f(t("%s at %d DPI. Save it into the mouse, and it works on any computer without this app."), t(FEELS.find((c) => c.preset === feel)?.title ?? "Balanced"), speed ?? 800)}</p>
          </div>
        )}

        <footer>
          {step > 0 && <button className="pill" onClick={() => setStep(step - 1)}>{t("Back")}</button>}
          <span className="spacer" />
          {step < 2 ? (
            <button className="suggested pill" disabled={step === 0 ? !feel : !speed} onClick={() => setStep(step + 1)}>{t("Next")}</button>
          ) : (
            <button className="suggested pill" onClick={() => void finish()}>{t("Save to mouse")}</button>
          )}
        </footer>
      </div>
    </div>
  );
}
