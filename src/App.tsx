// The app: a connect screen with the hero animation, then the studio. The studio has a top bar (tabs,
// edited profile, battery, save), the large mouse in the middle, the settings panel next to it, and the
// bar that slides up while there are unsaved changes.
import { useEffect, useRef, useState } from "react";
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router";
import { RATES_HZ, batteryStateText } from "./hid/device";
import { Dropdown, useDismiss } from "./components/controls";
import { DialogHost } from "./components/dialogs";
import { Icon, type IconName } from "./components/icons";
import { QuickSetup, useFirstConnectSetup } from "./components/QuickSetup";
import { Stage } from "./components/Stage";
import { waveMice } from "./components/MouseView";
import { inputPress, inputWheel, session } from "./components/useMouseInput";
import { f, t, tc, tn, useLanguage } from "./i18n/i18n";
import { Illustration } from "./illustrations/Illustration";
import AimPage from "./pages/AimPage";
import ButtonsPage from "./pages/ButtonsPage";
import ClickPage from "./pages/ClickPage";
import DevicePage, { LanguagePicker } from "./pages/DevicePage";
import ProfilesPage from "./pages/ProfilesPage";
import {
  autoConnect, connect, connectDemo, discard, getState, markDirty, save, setEdit, slotOf, unsavedFelt, useStore, type State,
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
          <Route path="click" element={<ClickPage />} />
          <Route path="aim" element={<AimPage />} />
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
  useFirstConnectSetup();
  const connected = status === "connected";
  return (
    <div className={`app ${connected && dirty ? "has-savebar" : ""}`} key={code}>
      {connected ? (
        <>
          <TopBar />
          <div className="studio">
            <Stage />
            <main className="panel">
              <div className="panel-body" key={pathname}>
                <Outlet />
              </div>
            </main>
            <SaveBar />
          </div>
          <QuickSetup />
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

/** The battery as a small cell filled to its level, with a bolt while charging. */
function Battery(props: { level: number; charging: boolean; low: boolean }) {
  const fill = props.level < 0 ? 0 : Math.max(2, Math.round((props.level / 100) * 16));
  return (
    <svg className={`battery-cell ${props.low ? "low" : ""} ${props.charging ? "charging" : ""}`} viewBox="0 0 24 12" width="24" height="12" aria-hidden>
      <rect x="0.75" y="0.75" width="20" height="10.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="22" y="3.5" width="2" height="5" rx="1" fill="currentColor" />
      <rect x="3" y="3" width={fill} height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Logo, mouse name and battery in one chip. A click makes the mouse say hello and opens its card. */
function DeviceChip() {
  const info = useStore((s) => s.info);
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLSpanElement>(null);
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, host, close);
  if (!info) return null;
  const charging = info.batteryState.startsWith("charg");
  const level = info.battery >= 0;
  const low = level && !charging && info.battery <= 15;
  const bat = level ? f(t("%d %%"), info.battery) : "";
  const label = [info.name, t("Connected"), bat, charging ? batteryStateText(info.batteryState) : ""].filter(Boolean).join(" · ");
  return (
    <span className="popover-anchor" ref={host}>
      <button className={`device-chip ${low ? "low" : ""} ${charging ? "charging" : ""} ${open ? "active" : ""}`} title={label} aria-label={label}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => (!open && waveMice(), setOpen(!open))}>
        <img src="./logo.svg" alt="" key={String(open)} className={open ? "hello" : ""} />
        <span className="name">{info.name}</span>
        {(level || charging) && (
          <span className="level">
            <Battery level={info.battery} charging={charging} low={low} />
            {charging && <Icon name="bolt" size={12} />}
            {bat}
          </span>
        )}
      </button>
      {open && <MouseCard close={close} />}
    </span>
  );
}

/** The mouse's card: what it runs right now, and what you did with it since this page opened. */
function MouseCard(props: { close: () => void }) {
  const s = useStore((x) => x);
  const navigate = useNavigate();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const info = s.info, p = s.profiles[s.active];
  if (!info) return null;
  const stage = p?.stages[info.stage];
  const rate = p ? (info.index === 0xff ? p.rateWired : p.rateWireless) : -1;
  // pointer travel on screen over the DPI in use: about how far the hand moved (pointer speed settings aside)
  const metres = stage?.x ? (session.travel * devicePixelRatio) / stage.x * 0.0254 : 0;
  const minutes = Math.max(1, Math.round((Date.now() - session.since) / 60000));
  const stats: [string, string][] = [
    [String(session.clicks), t("clicks")],
    [String(session.notches), t("wheel notches")],
    [metres >= 1 ? f(t("%.1f m"), metres) : f(t("%d cm"), Math.round(metres * 100)), t("hand travel")],
  ];
  return (
    <div className="popover mouse-card" role="dialog" aria-label={info.name}>
      <header>
        <img src="./logo.svg" alt="" />
        <div>
          <b>{info.name}</b>
          <span className="ss-hint">{info.index === 0xff ? t("Cable") : f(t("Receiver, slot %d"), info.index)}{info.demo ? ` · ${t("Demo mouse")}` : ""}</span>
        </div>
      </header>
      <div className="now">
        <span><Icon name="profiles" />{p ? profileLabel(s, s.active) : "—"}</span>
        <span><Icon name="sensor" />{stage?.x ? `${stage.x} DPI` : "—"}</span>
        <span><Icon name="device" />{rate >= 0 ? `${RATES_HZ[rate]} Hz` : "—"}</span>
      </div>
      <span className="ss-title">{f(t("This session · %d min"), minutes)}</span>
      <div className="session">
        {stats.map(([v, k]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
      </div>
      <footer>
        <button className="flat" onClick={() => waveMice()}>{t("Say hello")}</button>
        <span className="spacer" />
        <button className="suggested pill" onClick={() => (props.close(), navigate("/device"))}>{t("Device settings")}</button>
      </footer>
    </div>
  );
}

function TopBar() {
  const dirty = useStore((s) => s.dirty.length);
  return (
    <header className="topbar">
      <DeviceChip />
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
      <button className="suggested pill save" disabled={!dirty} onClick={() => void save()} title={t("Write the changes into the mouse memory (Ctrl+S)")}>
        <Icon name="save" />
        <span>{t("Save to mouse")}</span>
        {dirty > 0 && <b className="count">{dirty}</b>}
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
  const felt = useStore(unsavedFelt);
  // keeps the last count and wording while sliding away
  const last = useRef({ n, felt });
  if (n) last.current = { n, felt };
  return (
    <div className={`savebar-wrap ${n ? "open" : ""}`} aria-hidden={!n}>
      <div className="savebar-inner">
        <div className="savebar" title={t("Write the changes into the mouse memory (Ctrl+S)")}>
          <Icon name="save" size={22} />
          <div className="text">
            <span className="heading">{f(tn("%d unsaved change", "%d unsaved changes", last.current.n), last.current.n)}</span>
            <span className="ss-hint">{last.current.felt
              ? t("Try them on your mouse now. Save to keep them, Discard to go back.")
              : t("Some of them take effect only after you save.")}</span>
          </div>
          <button className="flat" disabled={!n} tabIndex={n ? 0 : -1} onClick={() => void discard()}>{t("Discard")}</button>
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
  const [help, setHelp] = useState(false);
  const showHelp = help || !!error; // a failed connect opens the help on its own
  return (
    <div className="connect-screen">
      <div className="connect-lang"><LanguagePicker /></div>
      <div className="connect-hero">
        <Illustration scene="hero" value={{}} label="PRO X3 SUPERSTRIKE" />
      </div>
      <h1>SuperStrike Studio Plus</h1>
      <p className="lead">{t("Tune the PRO X3 SUPERSTRIKE: click feel, aim and buttons, saved into the mouse.")}</p>
      {!supported && <p className="error">This browser has no WebHID. Use Chrome, Edge or another Chromium browser.</p>}
      {embedded && <p className="error">WebHID is blocked here (embedded preview or iframe). Open {location.href} in a normal browser window.</p>}
      <div className="actions">
        {supported && !embedded && (
          <button className="suggested pill big" disabled={busy} onClick={() => void connect()}>
            {busy ? <><span className="spinner" />{t("Searching for the mouse…")}</> : "Connect the mouse…"}
          </button>
        )}
        <button className="pill big" disabled={busy} onClick={() => void connectDemo()}>{t("Try the demo")}</button>
      </div>
      {error && <p className="error">{error}</p>}
      {supported && !embedded && (
        <>
          {!showHelp && <button className="flat help-link" onClick={() => setHelp(true)}>{t("Trouble connecting?")}</button>}
          {showHelp && (
            <div className="connect-help">
              <p className="ss-hint">{t("Pick the LIGHTSPEED receiver (\"USB Receiver\") or the mouse on its cable. The browser remembers your choice.")}</p>
              <p className="ss-hint">{t("Linux: the list is empty? Your user needs access to the receiver. Add a udev rule, then replug the receiver:")}</p>
              <pre>{`echo 'KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="046d", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/70-superstrike.rules
sudo udevadm control --reload-rules && sudo udevadm trigger`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Screenshot states with the demo mouse (tools/parity/shots.mjs): profile=N edits profile N, dirty=1
 * marks it unsaved (nothing is written), press=1 holds the left button and rolls the wheel so the
 * picture shows the live view. Panels read tab= and view= themselves. `?shot` skips the quick setup.
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
