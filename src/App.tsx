// The app: a connect screen with the hero animation, then the studio. The studio has a top bar (tabs,
// edited profile, battery, save), the large mouse in the middle, the settings panel next to it, and the
// bar that slides up while there are unsaved changes.
import { useEffect, useRef } from "react";
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router";
import { Dropdown } from "./components/controls";
import { DialogHost } from "./components/dialogs";
import { Icon, type IconName } from "./components/icons";
import { Stage } from "./components/Stage";
import { inputPress, inputWheel } from "./components/useMouseInput";
import { f, t, tc, tn, useLanguage } from "./i18n/i18n";
import { Illustration } from "./illustrations/Illustration";
import ButtonsPage from "./pages/ButtonsPage";
import DevicePage, { LanguagePicker } from "./pages/DevicePage";
import HitsPage from "./pages/HitsPage";
import ProfilesPage from "./pages/ProfilesPage";
import SensorPage from "./pages/SensorPage";
import {
  autoConnect, connect, connectDemo, getState, markDirty, revert, save, setEdit, slotOf, useStore, type State,
} from "./state/store";

const TABS: { to: string; title: string; icon: IconName }[] = [
  { to: "/click", title: "Click", icon: "hits" },
  { to: "/aim", title: "Aim", icon: "sensor" },
  { to: "/buttons", title: "Buttons", icon: "buttons" },
  { to: "/profiles", title: "Profiles", icon: "profiles" },
  { to: "/device", title: "Device", icon: "device" },
];

export default function App() {
  useEffect(() => void autoConnect(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    // Closing or reloading the tab with unsaved changes: the browser asks (it shows its own text).
    const onLeave = (e: BeforeUnloadEvent) => {
      if (getState().dirty.length && getState().status === "connected") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, []);
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/click" replace />} />
          <Route path="click" element={<HitsPage />} />
          <Route path="aim" element={<SensorPage />} />
          <Route path="buttons" element={<ButtonsPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="device" element={<DevicePage />} />
          <Route path="hits" element={<Navigate to="/click" replace />} />
          <Route path="sensor" element={<Navigate to="/aim" replace />} />
          <Route path="*" element={<Navigate to="/click" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

/** "Profile 2" or "Profile 2 · Fast". */
export function profileLabel(s: State, sector: number) {
  const n = slotOf(s, sector) + 1;
  const name = s.profiles[sector]?.name;
  return name ? f(t("Profile %d · %s"), n, name) : f(t("Profile %d"), n);
}

function Layout() {
  const status = useStore((s) => s.status);
  const dirty = useStore((s) => s.dirty.length);
  const { code } = useLanguage(); // rebuild everything when the language changes, like set_language()
  const { pathname } = useLocation();
  useShotParams();
  const connected = status === "connected";
  return (
    <div className={`app ${connected && dirty ? "has-savebar" : ""}`} key={code}>
      {connected ? (
        <>
          <TopBar />
          <div className="studio">
            <Stage />
            <main className="panel" key={pathname}>
              <Outlet />
            </main>
          </div>
          <SaveBar />
        </>
      ) : (
        <ConnectScreen />
      )}
      <Toasts />
      <Busy />
      <DialogHost />
    </div>
  );
}

function TopBar() {
  const info = useStore((s) => s.info);
  const dirty = useStore((s) => s.dirty.length);
  const charging = !!info?.batteryState.startsWith("charg");
  const level = !!info && info.battery >= 0;
  // "82 %", "82 % ⚡" while charging, "⚡" when the level is unknown
  let bat = level ? `${info!.battery} %` : "";
  if (charging) bat += bat ? " ⚡" : "⚡";
  const low = level && !charging && info!.battery <= 15;
  return (
    <header className="topbar">
      <div className="brand" title={info?.name}>
        <img src="./logo.svg" alt="" />
        <span className="dot ok" aria-label={t("Connected")}>●</span>
      </div>
      <nav className="tabs">
        {TABS.map((p) => (
          <NavLink key={p.to} to={p.to} className={({ isActive }) => (isActive ? "on" : "")}>
            <Icon name={p.icon} size={18} />
            <span>{tc("page", p.title)}</span>
          </NavLink>
        ))}
      </nav>
      <EditedProfile />
      <span className="spacer" />
      {bat && <span className={`battery ${low ? "low" : ""}`}>{bat}</span>}
      <button className="suggested pill save" disabled={!dirty} onClick={() => void save()} title={t("Write the changes into the mouse memory (Ctrl+S)")}>
        <Icon name="save" />
        <span>{t("Save to mouse")}</span>
      </button>
    </header>
  );
}

function EditedProfile() {
  const s = useStore((s) => s);
  const options = s.dir.map((e) => {
    let label = e.sector === s.active ? f(t("%s  (active)"), profileLabel(s, e.sector)) : profileLabel(s, e.sector);
    if (s.dirty.includes(e.sector)) label += "  •";
    return { value: e.sector, label };
  });
  if (s.blank) return <span className="ss-badge" title={t("The profile you are editing")}>{t("Factory profile")}</span>;
  return <Dropdown className="profile-switch" value={s.edit} options={options} onChange={setEdit} tooltip={t("The profile you are editing")} />;
}

function SaveBar() {
  const n = useStore((s) => (s.status === "connected" ? s.dirty.length : 0));
  const blank = useStore((s) => s.blank);
  // keeps the last count while sliding away
  const last = useRef(n);
  if (n) last.current = n;
  return (
    <div className={`savebar-wrap ${n ? "open" : ""}`} aria-hidden={!n}>
      <div>
        <div className="savebar">
          <Icon name="save" size={22} />
          <div className="text">
            <span className="heading">{f(tn("%d unsaved change", "%d unsaved changes", last.current), last.current)}</span>
            <span className="ss-hint">{t("Only a preview until you save it into the mouse (Ctrl+S).")}</span>
          </div>
          <span className="spacer" />
          <button className="flat" disabled={!n} tabIndex={n ? 0 : -1} onClick={() => void revert()}>{t("Discard")}</button>
          <button className="suggested pill" disabled={!n} tabIndex={n ? 0 : -1} onClick={() => void save()} title={t("Write the changes into the mouse memory (Ctrl+S)")}>
            {t("Save to mouse")}{blank ? "…" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PolicyApi {
  allowsFeature(feature: string): boolean;
}

/** The first screen: the hero animation, Connect and Try the demo. The browser shows its device list only after a click. */
function ConnectScreen() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const supported = useStore((s) => s.supported);
  // Permissions Policy is not in the TypeScript DOM types yet.
  const doc = document as Document & { permissionsPolicy?: PolicyApi; featurePolicy?: PolicyApi };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  const embedded = supported && policy !== undefined && !policy.allowsFeature("hid");
  const busy = status !== "disconnected";
  return (
    <div className="connect-screen">
      <div className="connect-lang"><LanguagePicker /></div>
      <div className="connect-hero">
        <Illustration scene="hero" value={{}} label="PRO X3 SUPERSTRIKE" />
      </div>
      <h1>SuperStrike Studio Plus</h1>
      <p className="lead">{t("Tune the PRO X3 SUPERSTRIKE: click feel, aim and buttons, saved into the mouse.")}</p>
      {!supported ? (
        <p className="error">This browser has no WebHID. Use Chrome, Edge or another Chromium browser.</p>
      ) : embedded ? (
        <p className="error">WebHID is blocked here (embedded preview or iframe). Open {location.href} in a normal browser window.</p>
      ) : (
        <p className="ss-hint">Pick the LIGHTSPEED receiver ("USB Receiver") or the mouse on its cable. The browser remembers your choice.</p>
      )}
      <div className="actions">
        {supported && !embedded && (
          <button className="suggested pill big" disabled={busy} onClick={() => void connect()}>
            {busy ? <><span className="spinner" />{t("Searching for the mouse…")}</> : "Connect the mouse…"}
          </button>
        )}
        <button className="pill big" disabled={busy} onClick={() => void connectDemo()}>Try the demo</button>
      </div>
      {error && <p className="error">{error}</p>}
      {supported && !embedded && (
        <details className="linux">
          <summary className="ss-hint">Linux: the list is empty?</summary>
          <p className="ss-hint">Your user needs access to the receiver. Add a udev rule, then replug the receiver:</p>
          <pre>{`echo 'KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="046d", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/70-superstrike.rules
sudo udevadm control --reload-rules && sudo udevadm trigger`}</pre>
        </details>
      )}
    </div>
  );
}

/**
 * Screenshot states with the demo mouse (tools/parity/shots.mjs): profile=N edits profile N, dirty=1
 * marks it unsaved (nothing is written), press=1 holds the left button and rolls the wheel so the
 * picture shows the live view. Panels read tab= and view= themselves.
 */
function useShotParams() {
  const [params] = useSearchParams();
  const ready = useStore((s) => s.status === "connected" && !!s.info?.demo);
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    const n = Number(params.get("profile"));
    const s = getState();
    if (n >= 1 && n <= s.dir.length) setEdit(s.dir[n - 1].sector);
    if (params.get("dirty")) markDirty(getState().edit);
    if (params.get("press")) {
      inputPress("btn-left", true);
      inputWheel(3);
    }
  }, [ready, params]);
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>
      ))}
    </div>
  );
}

function Busy() {
  const busy = useStore((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="busy" role="alert" aria-busy="true">
      <div><span className="spinner" />{busy}</div>
    </div>
  );
}
