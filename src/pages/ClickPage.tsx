// Click panel (upstream page_hits.cpp): pick the button, then actuation, rapid trigger and haptics,
// each on a card whose animation plays the value set on that button. The click test lives on the
// large mouse (Test clicks).
import { FxCard, Segments, Steps } from "../components/cards";
import { IconButton, MenuButton, Switch } from "../components/controls";
import type { Hits } from "../hid/device";
import { f, t, tc } from "../i18n/i18n";
import { commit, copyCode, importCode, same } from "../state/hits";
import { currentProfile, useStore } from "../state/store";
import { setStudio, useStudio, type Target } from "../state/studio";

export default function ClickPage() {
  const profile = useStore(currentProfile);
  const target = useStudio((s) => s.target);
  if (!profile) return null;
  const [L, R] = profile.hits;
  const h = target === "right" ? R : L;
  const edit = (fn: (h: Hits) => void) => {
    const n = { ...h };
    fn(n);
    commit([target === "right" ? L : n, target === "left" ? R : n]);
  };
  // both buttons and they differ: show both mice side by side, left then right
  const pair = target === "both" && !same(L, R);
  const each = <T,>(get: (x: Hits) => T) => (pair ? [get(L), get(R)] : [get(h)]);
  const on = pair ? undefined : target;

  return (
    <>
      <div className="panel-head">
        <h2>{tc("page", "Click")}</h2>
        <span className="spacer" />
        <MenuButton icon="code" tooltip={t("HITS code")}>
          {(close) => (
            <>
              <button onClick={() => (close(), void copyCode())}>{t("Copy HITS code")}</button>
              <button onClick={() => (close(), void importCode())}>{t("Import HITS code…")}</button>
            </>
          )}
        </MenuButton>
      </div>

      <FxCard title={t("Button")} icon="mouse">
        <p className="ss-hint">{t("The button these settings apply to. You can also click it on the mouse.")}</p>
        <Segments<Target> value={target} onChange={(v) => setStudio({ target: v })} label={t("Button")}
          options={[{ value: "left", label: tc("HITS target", "Left") }, { value: "right", label: tc("HITS target", "Right") }, { value: "both", label: t("Both (L+R)") }]} />
        {pair && <span className="ss-badge warn wrap">{t("L and R differ — changes apply to both")}</span>}
      </FxCard>

      <FxCard title={t("Actuation")} icon="actuation" value={<>{h.act}<small>{f(t("≈ %.1f mm"), h.act * 0.1)}</small></>}
        scene="actuation" sceneValue={{ act: each((x) => x.act), on }} tall>
        <p className="ss-hint">{t("Where along the press the click fires. Short = faster, long = fewer misclicks.")}</p>
        <div className="row-head">
          <div style={{ flex: 1 }}>
            <Steps lo={1} hi={10} value={h.act} onChange={(v) => edit((x) => (x.act = v))} label={t("Actuation")}
              loText={tc("travel bar", "Short click")} hiText={tc("travel bar", "Long click")} />
          </div>
          <IconButton icon="rotate" tooltip={t("Reset to 5")} onClick={() => edit((x) => (x.act = 5))} />
        </div>
      </FxCard>

      <FxCard className="rapid" title={t("Rapid trigger")} icon="rapid" value={h.rtOn ? <>{h.rt}<small>{t("of 5")}</small></> : tc("level value", "off")}
        scene="rapid" sceneValue={{ rt: each((x) => (x.rtOn ? x.rt : 0)), on }} tall>
        <p className="ss-hint">{t("After a click, lifting the button by this much re-arms it, so fast repeated clicks need less travel.")}</p>
        <div className="row-head">
          <span>{t("Rapid trigger")}</span>
          <span className="spacer" />
          <Switch checked={h.rtOn} onChange={(v) => edit((x) => (x.rtOn = v))} label={t("Rapid trigger")} />
        </div>
        <Steps lo={1} hi={5} value={h.rt} disabled={!h.rtOn} onChange={(v) => edit((x) => (x.rt = v))} label={t("Rapid trigger")}
          loText={tc("rapid trigger level", "Most sensitive")} hiText={tc("rapid trigger level", "Least")} />
      </FxCard>

      <FxCard title={t("Haptics")} icon="haptics" value={h.hap ? <>{h.hap}<small>{t("of 5")}</small></> : tc("level value", "off")}
        scene="haptics" sceneValue={{ level: h.hap, on: target }} tall>
        <p className="ss-hint">{t("Click feel strength. Higher levels use more battery.")}</p>
        <Segments<number> value={h.hap} onChange={(v) => edit((x) => (x.hap = v))} label={t("Haptics")}
          options={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: v ? String(v) : tc("haptics level", "Off") }))} />
      </FxCard>
    </>
  );
}
