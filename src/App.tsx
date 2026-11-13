// Main window like upstream window.cpp: sidebar (device card, navigation, edited profile), header
// (page title, profile subtitle), banner while not connected, pages, and the unsaved-changes bar.
import { useEffect, useRef } from "react";
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router";
import { Dropdown } from "./components/controls";
import { DialogHost } from "./components/dialogs";
import { Icon, type IconName } from "./components/icons";
import { inputPress, inputWheel } from "./components/useMouseInput";
import { f, t, tc, tn, useLanguage } from "./i18n/i18n";
import ButtonsPage from "./pages/ButtonsPage";
import DevicePage, { LanguagePicker } from "./pages/DevicePage";
import HitsPage from "./pages/HitsPage";
import ProfilesPage from "./pages/ProfilesPage";
import SensorPage from "./pages/SensorPage";
import {
  autoConnect, connect, connectDemo, getState, markDirty, revert, save, setEdit, slotOf, useStore, type State,
} from "./state/store";

const PAGES: { to: string; title: string; icon: IconName }[] = [
  { to: "/hits", title: "HITS tuning", icon: "hits" },
  { to: "/buttons", title: "Buttons", icon: "buttons" },
  { to: "/sensor", title: "Sensor", icon: "sensor" },
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
          <Route index element={<Navigate to="/hits" replace />} />
          <Route path="hits" element={<HitsPage />} />
          <Route path="buttons" element={<ButtonsPage />} />
          <Route path="sensor" element={<SensorPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="device" element={<DevicePage />} />
          <Route path="*" element={<Navigate to="/hits" replace />} />
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
      <Sidebar />
      <div className="main">
        <Header />
        {!connected && (
          <div className="banner" role="status">
            <span>{t("Searching for the PRO X3 SUPERSTRIKE — switch the mouse on or plug in the receiver")}</span>
            <button className="suggested" disabled={status !== "disconnected"} onClick={() => void connect()}>{t("Retry")}</button>
          </div>
        )}
        <div className="content">
          <div className="page-fade" key={connected ? pathname : "connect"}>
            {connected ? <Outlet /> : <ConnectCard />}
          </div>
        </div>
        <SaveBar />
      </div>
      <Toasts />
      <Busy />
      <DialogHost />
    </div>
  );
}

function Sidebar() {
  const info = useStore((s) => s.info);
  const connected = useStore((s) => s.status === "connected");
  const charging = connected && !!info?.batteryState.startsWith("charg");
  const level = connected && !!info && info.battery >= 0;
  // battery after the status: "82 %", "82 % ⚡" while charging, "⚡" when the level is unknown
  let bat = level ? `${info!.battery} %` : "";
  if (charging) bat += bat ? " ⚡" : "⚡";
  const low = level && !charging && info!.battery <= 15;
  return (
    <nav className="sidebar">
      <div className="device-card">
        <img src="./logo.svg" alt="" />
        <div className="info">
          <span className="name">{info?.name ?? "PRO X3 SUPERSTRIKE"}</span>
          <span className="status">
            <span className={`dot ${connected ? "ok" : ""}`}>●</span>
            <span className="text">{connected ? t("Connected") : t("Searching for the mouse…")}</span>
            {bat && <span className={`battery ${low ? "low" : ""}`}>· {bat}</span>}
          </span>
        </div>
      </div>
      <div className="nav">
        {PAGES.map((p) => (
          <NavLink key={p.to} to={p.to} className={({ isActive }) => (isActive ? "on" : "")}>
            <Icon name={p.icon} size={18} />
            {tc("page", p.title)}
          </NavLink>
        ))}
      </div>
      <EditedProfile />
    </nav>
  );
}

function EditedProfile() {
  const s = useStore((s) => s);
  const connected = s.status === "connected";
  const options = s.dir.map((e) => {
    let label = e.sector === s.active ? f(t("%s  (active)"), profileLabel(s, e.sector)) : profileLabel(s, e.sector);
    if (s.dirty.includes(e.sector)) label += "  •";
    return { value: e.sector, label };
  });
  return (
    <div className="editing">
      <span className="ss-title">{t("EDITING")}</span>
      <Dropdown value={s.edit} options={connected ? options : []} onChange={setEdit} disabled={!connected} tooltip={t("The profile you are editing")} up />
    </div>
  );
}

function Header() {
  const s = useStore((s) => s);
  const { pathname } = useLocation();
  const page = PAGES.find((p) => pathname.startsWith(p.to)) ?? PAGES[0];
  const sub = s.status !== "connected" ? t("Not connected")
    : s.edit < 0 ? ""
    : s.blank ? "Factory profile (no saved profiles yet)"
    : s.edit === s.active ? f(t("%s · Active"), profileLabel(s, s.edit))
    : f(t("%s · not active"), profileLabel(s, s.edit));
  return (
    <header className="header">
      <span className="title">{tc("page", page.title)}</span>
      {sub && <span className="subtitle">{sub}</span>}
    </header>
  );
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

/** Web only: the browser shows its device list only after a click, so the page offers one. */
function ConnectCard() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const supported = useStore((s) => s.supported);
  // Permissions Policy is not in the TypeScript DOM types yet.
  const doc = document as Document & { permissionsPolicy?: PolicyApi; featurePolicy?: PolicyApi };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  const embedded = supported && policy !== undefined && !policy.allowsFeature("hid");
  const busy = status !== "disconnected";
  return (
    <div className="scroll">
      <div className="column narrow">
        <section className="ss-panel connect">
          <div className="row-head">
            <h2 className="ss-title">PRO X3 SUPERSTRIKE</h2>
            <span className="spacer" />
            <LanguagePicker />
          </div>
          {!supported ? (
            <p className="error">This browser has no WebHID. Use Chrome, Edge or another Chromium browser.</p>
          ) : embedded ? (
            <p className="error">WebHID is blocked here (embedded preview or iframe). Open {location.href} in a normal browser window.</p>
          ) : (
            <>
              <p className="ss-hint">Pick the LIGHTSPEED receiver ("USB Receiver") or the mouse on its cable. The browser remembers your choice.</p>
              <div className="actions">
                <button className="suggested pill" disabled={busy} onClick={() => void connect()}>
                  {busy ? t("Searching for the mouse…") : "Connect the mouse…"}
                </button>
                <button className="pill" disabled={busy} onClick={() => void connectDemo()}>Try the demo</button>
              </div>
              {error && <p className="error">{error}</p>}
              <details>
                <summary className="ss-hint">Linux: the list is empty?</summary>
                <p className="ss-hint">Your user needs access to the receiver. Add a udev rule, then replug the receiver:</p>
                <pre>{`echo 'KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="046d", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/70-superstrike.rules
sudo udevadm control --reload-rules && sudo udevadm trigger`}</pre>
              </details>
            </>
          )}
          {!supported && (
            <div className="actions">
              <button className="pill" onClick={() => void connectDemo()}>Try the demo</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Screenshot states with the demo mouse, like upstream's --shot settings (tools/parity/shots.mjs):
 * profile=N edits profile N, dirty=1 marks it unsaved (nothing is written), press=1 holds the left
 * button and rolls the wheel so the picture shows the live view. Pages read tab= and view= themselves.
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
