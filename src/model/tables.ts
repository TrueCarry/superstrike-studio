// Name tables for button actions, plus browser KeyboardEvent.code -> HID usage for key recording.
// Names are English message ids; nameText() gives the translated name (gettext context per table).
import { t, tc } from "../i18n/i18n";

export interface Named {
  name: string;
  code: number;
}

export const MOUSE_BUTTONS: Named[] = [
  { name: "Left click", code: 0x0001 }, { name: "Right click", code: 0x0002 },
  { name: "Middle click", code: 0x0004 }, { name: "Back", code: 0x0008 },
  { name: "Forward", code: 0x0010 }, { name: "Button 6", code: 0x0020 },
  { name: "Button 7", code: 0x0040 }, { name: "Button 8", code: 0x0080 },
];

export const FUNCTIONS: Named[] = [
  { name: "Next DPI", code: 0x03 }, { name: "Previous DPI", code: 0x04 },
  { name: "Cycle DPI", code: 0x05 }, { name: "Default DPI", code: 0x06 },
  { name: "DPI shift (hold)", code: 0x07 }, { name: "Next profile", code: 0x08 },
  { name: "Previous profile", code: 0x09 }, { name: "Cycle profile", code: 0x0a },
  { name: "Battery status", code: 0x0c }, { name: "Scroll down", code: 0x10 },
  { name: "Scroll up", code: 0x11 }, { name: "Tilt left", code: 0x01 },
  { name: "Tilt right", code: 0x02 },
];

export const MEDIA: Named[] = [
  { name: "Play / Pause", code: 0x00cd }, { name: "Next track", code: 0x00b5 },
  { name: "Previous track", code: 0x00b6 }, { name: "Stop", code: 0x00b7 },
  { name: "Mute", code: 0x00e2 }, { name: "Volume up", code: 0x00e9 },
  { name: "Volume down", code: 0x00ea }, { name: "Brightness up", code: 0x006f },
  { name: "Brightness down", code: 0x0070 }, { name: "Calculator", code: 0x0192 },
  { name: "Browser home", code: 0x0223 }, { name: "Browser back", code: 0x0224 },
  { name: "Browser forward", code: 0x0225 }, { name: "Browser refresh", code: 0x0227 },
  { name: "Mail", code: 0x018a }, { name: "File manager", code: 0x0194 },
];

export const MODIFIERS: Named[] = [
  { name: "Ctrl", code: 0x01 }, { name: "Shift", code: 0x02 }, { name: "Alt", code: 0x04 },
  { name: "Super", code: 0x08 }, { name: "Right Ctrl", code: 0x10 }, { name: "Right Shift", code: 0x20 },
  { name: "AltGr", code: 0x40 }, { name: "Right Super", code: 0x80 },
];

function makeKeys(): Named[] {
  const k: Named[] = [];
  for (let i = 0; i < 26; i++) k.push({ name: String.fromCharCode(65 + i), code: 0x04 + i });
  for (let i = 0; i < 10; i++) k.push({ name: String((i + 1) % 10), code: 0x1e + i });
  k.push(
    { name: "Enter", code: 0x28 }, { name: "Escape", code: 0x29 }, { name: "Backspace", code: 0x2a },
    { name: "Tab", code: 0x2b }, { name: "Space", code: 0x2c }, { name: "-", code: 0x2d }, { name: "=", code: 0x2e },
    { name: "[", code: 0x2f }, { name: "]", code: 0x30 }, { name: "\\", code: 0x31 }, { name: ";", code: 0x33 },
    { name: "'", code: 0x34 }, { name: "`", code: 0x35 }, { name: ",", code: 0x36 }, { name: ".", code: 0x37 },
    { name: "/", code: 0x38 }, { name: "Caps Lock", code: 0x39 },
  );
  for (let i = 0; i < 12; i++) k.push({ name: `F${i + 1}`, code: 0x3a + i });
  k.push(
    { name: "Print Screen", code: 0x46 }, { name: "Scroll Lock", code: 0x47 }, { name: "Pause", code: 0x48 },
    { name: "Insert", code: 0x49 }, { name: "Home", code: 0x4a }, { name: "Page Up", code: 0x4b },
    { name: "Delete", code: 0x4c }, { name: "End", code: 0x4d }, { name: "Page Down", code: 0x4e },
    { name: "Right arrow", code: 0x4f }, { name: "Left arrow", code: 0x50 }, { name: "Down arrow", code: 0x51 },
    { name: "Up arrow", code: 0x52 }, { name: "Menu", code: 0x65 },
  );
  for (let i = 0; i < 12; i++) k.push({ name: `F${13 + i}`, code: 0x68 + i });
  for (let i = 1; i <= 9; i++) k.push({ name: `Keypad ${i}`, code: 0x58 + i });
  k.push(
    { name: "Keypad 0", code: 0x62 }, { name: "Keypad Enter", code: 0x58 },
    { name: "Ctrl (alone)", code: 0xe0 }, { name: "Shift (alone)", code: 0xe1 }, { name: "Alt (alone)", code: 0xe2 },
  );
  return k;
}
export const KEYS = makeKeys();

const BUTTON_NAMES = ["Left button", "Right button", "Middle button (wheel click)", "Back (rear side)", "Forward (front side)"];
const SHORT_NAMES = ["Left", "Right", "Middle", "Back", "Forward"];
export const buttonName = (i: number) => t(BUTTON_NAMES[i]);
export const shortName = (i: number) => tc("button label", SHORT_NAMES[i]);

const CONTEXTS = new Map<Named[], string>([
  [MOUSE_BUTTONS, "mouse button"], [FUNCTIONS, "button function"], [MEDIA, "media key"], [MODIFIERS, "modifier key"], [KEYS, "keyboard key"],
]);
/** Translated display name of a table entry. Generated names (A, 1, F5, -) have no translation and stay as they are. */
export const nameText = (table: Named[], n: Named) => tc(CONTEXTS.get(table) ?? "", n.name);
export const BUTTON_ZONES = ["btn-left", "btn-right", "btn-middle", "btn-back", "btn-forward"] as const;
export type Zone = (typeof BUTTON_ZONES)[number];

/** KeyboardEvent.code -> HID keyboard usage. */
export function codeToHid(code: string): number {
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return 0x04 + m[1].charCodeAt(0) - 65;
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1] === "0" ? 0x27 : 0x1e + Number(m[1]) - 1;
  m = /^F(\d+)$/.exec(code);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return 0x3a + n - 1;
    if (n >= 13 && n <= 24) return 0x68 + n - 13;
  }
  m = /^Numpad(\d)$/.exec(code);
  if (m) return m[1] === "0" ? 0x62 : 0x59 + Number(m[1]) - 1;
  const fixed: Record<string, number> = {
    Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c, Minus: 0x2d, Equal: 0x2e,
    BracketLeft: 0x2f, BracketRight: 0x30, Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
    Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39, PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
    Insert: 0x49, Home: 0x4a, PageUp: 0x4b, Delete: 0x4c, End: 0x4d, PageDown: 0x4e, ArrowRight: 0x4f,
    ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52, NumLock: 0x53, NumpadDivide: 0x54, NumpadMultiply: 0x55,
    NumpadSubtract: 0x56, NumpadAdd: 0x57, NumpadEnter: 0x58, NumpadDecimal: 0x63, IntlBackslash: 0x64,
    ContextMenu: 0x65, ControlLeft: 0xe0, ShiftLeft: 0xe1, AltLeft: 0xe2, MetaLeft: 0xe3, ControlRight: 0xe4,
    ShiftRight: 0xe5, AltRight: 0xe6, MetaRight: 0xe7,
  };
  return fixed[code] ?? -1;
}

/** Modifier usage 0xE0..0xE7 -> its bit in the HID modifier byte, else 0. */
export const modifierBit = (usage: number) => (usage >= 0xe0 && usage <= 0xe7 ? 1 << (usage - 0xe0) : 0);
