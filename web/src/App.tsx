import { useEffect } from "react";
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes } from "react-router";
import { slotOf } from "./state/store";
import ButtonsPage from "./pages/ButtonsPage";
import DevicePage from "./pages/DevicePage";
import HitsPage from "./pages/HitsPage";
import ProfilesPage from "./pages/ProfilesPage";
import SensorPage from "./pages/SensorPage";
import { autoConnect, connect, revert, save, setEdit, useStore } from "./state/store";

const NAV = [
  { to: "/hits", label: "HITS" },
  { to: "/buttons", label: "Buttons" },
  { to: "/sensor", label: "Sensor" },
  { to: "/profiles", label: "Profiles" },
  { to: "/device", label: "Device" },
];

export default function App() {
  useEffect(() => void autoConnect(), []);
  // Ctrl+S saves, like upstream.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

function Layout() {
  const status = useStore((s) => s.status);
  return (
    <div className="app">
      <Sidebar />
      <main>{status === "connected" ? <><TopBar /><Outlet /></> : <ConnectScreen />}</main>
      <Toasts />
      <Busy />
    </div>
  );
}

function Sidebar() {
  const info = useStore((s) => s.info);
  const status = useStore((s) => s.status);
  return (
    <nav className="sidebar">
      <div className="brand">
        <img src="./favicon.svg" alt="" />
        <span>SuperStrike Studio</span>
      </div>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "on" : "")}>{n.label}</NavLink>
      ))}
      <div className="device-card">
        {status === "connected" && info ? (
          <>
            <strong>{info.name}</strong>
            <span>{info.battery < 0 ? "Battery unknown" : `Battery ${info.battery} % · ${info.batteryState}`}</span>
            <meter min={0} max={100} low={20} high={50} optimum={100} value={Math.max(0, info.battery)} />
          </>
        ) : (
          <span>{status === "disconnected" ? "Not connected" : "Connecting…"}</span>
        )}
      </div>
    </nav>
  );
}

function TopBar() {
  const dir = useStore((s) => s.dir);
  const edit = useStore((s) => s.edit);
  const active = useStore((s) => s.active);
  const dirty = useStore((s) => s.dirty);
  const profiles = useStore((s) => s.profiles);
  const blank = useStore((s) => s.blank);
  const state = useStore((s) => s);
  if (blank) {
    return (
      <header className="topbar">
        <span>Factory profile <small>(no saved profiles yet — the first save creates them)</small></span>
        <span className="spacer" />
        {dirty.length > 0 && <span className="badge warn">unsaved</span>}
        <button disabled={!dirty.length} onClick={() => void revert()}>Revert</button>
        <button className="suggested" disabled={!dirty.length} onClick={() => void save()} title="Ctrl+S">Save to mouse…</button>
      </header>
    );
  }
  return (
    <header className="topbar">
      <label>
        Editing{" "}
        <select value={edit} onChange={(e) => setEdit(Number(e.target.value))}>
          {dir.map((e, i) => (
            <option key={e.sector} value={e.sector}>
              Profile {i + 1}{profiles[e.sector]?.name ? ` — ${profiles[e.sector].name}` : ""}{e.sector === active ? " (active)" : ""}
            </option>
          ))}
        </select>
      </label>
      {edit !== active && <span className="badge">Not the active profile (slot {slotOf(state, active) + 1} is)</span>}
      <span className="spacer" />
      {dirty.length > 0 && <span className="badge warn">{dirty.length} unsaved</span>}
      <button disabled={!dirty.length} onClick={() => {
        if (confirm("Drop unsaved changes and read everything from the mouse again?")) void revert();
      }}>Revert</button>
      <button className="suggested" disabled={!dirty.length} onClick={() => void save()} title="Ctrl+S">Save to mouse</button>
    </header>
  );
}

interface PolicyApi {
  allowsFeature(feature: string): boolean;
}

function ConnectScreen() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const supported = useStore((s) => s.supported);
  // Permissions Policy is not in the TypeScript DOM types yet.
  const doc = document as Document & { permissionsPolicy?: PolicyApi; featurePolicy?: PolicyApi };
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  const embedded = supported && policy !== undefined && !policy.allowsFeature("hid");
  return (
    <div className="connect">
      <h1>Connect your PRO X2 / X3 SUPERSTRIKE</h1>
      {!supported ? (
        <p className="error">This browser has no WebHID. Use Chrome, Edge or another Chromium browser.</p>
      ) : embedded ? (
        <p className="error">WebHID is blocked here (embedded preview or iframe). Open {location.href} in a normal browser window.</p>
      ) : (
        <>
          <button className="suggested big-button" disabled={status !== "disconnected"} onClick={() => void connect()}>
            {status === "disconnected" ? "Connect" : status === "connecting" ? "Looking for the mouse…" : "Reading the mouse…"}
          </button>
          {error && <p className="error">{error}</p>}
          <p className="hint">Pick the LIGHTSPEED receiver ("USB Receiver") or the mouse on its cable. The browser remembers your choice.</p>
          <details>
            <summary>Linux: the list is empty?</summary>
            <p>Your user needs access to the receiver. Add a udev rule, then replug the receiver:</p>
            <pre>{`echo 'KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="046d", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/70-superstrike.rules
sudo udevadm control --reload-rules && sudo udevadm trigger`}</pre>
          </details>
        </>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
      ))}
    </div>
  );
}

function Busy() {
  const busy = useStore((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal"><p>{busy}</p><p className="hint">Keep the mouse and receiver connected.</p></div>
    </div>
  );
}
