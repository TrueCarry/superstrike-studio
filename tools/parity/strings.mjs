// String parity: which native UI texts the web app never shows, and which web texts are not in the
// translation catalog. The catalog po/superstrike-studio.pot still records the native source file
// of every string (#: src/page_hits.cpp:...), so unused ones point at dropped features.
//   node tools/parity/strings.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Native strings the web app leaves out on purpose, with the reason.
const NOT_PORTED = {
  "Check for updates": "the web page is always the latest version",
  "Check for updates automatically": "the web page is always the latest version",
  "At most once a day, one request to github.com": "update check",
  "Update available": "update check", "Download": "update check", "Later": "update check",
  "SuperStrike Studio is up to date": "update check",
  "Version %s is out (you have %s). Download it from GitHub?": "update check",
  "Could not check for updates: %s": "update check",
  "Could not write file: %s": "files are saved by the browser",
  "Could not read file: %s": "files are read by the browser",
  "Exported to %s": "files are saved by the browser",
  "Backup saved: %s": "files are saved by the browser",
  "Save memory backup": "the browser's save dialog", "Open memory backup": "the browser's open dialog",
  "Export profile": "the browser's save dialog", "Import profile": "the browser's open dialog",
  "Save failed: %s. Backups: %s": "backups live in the browser, not a folder",
  "The app also makes a full backup automatically before the first save of each session, in %s.": "backups live in the browser, not a folder",
  "This overwrites the profiles in the mouse with the contents of %s. The current memory is saved to the backup folder first.": "backups live in the browser, not a folder",
  "Restart to finish switching the language": "the web app switches at once",
  "Version %s is available": "update check", "You have version %s. The new version is on GitHub.": "update check",
  "Skip this version": "update check", "Open download page": "update check",
  "Update check failed: %s": "update check", "You have the latest version (%s)": "update check",
  "Save this profile first": "native fallback behind the Profiles page's \"Save Profile %d first\"",
  "Use this stage now": "hidden in native too: clicking a stage chip switches the mouse",
  "Activate this profile first (Profiles page)": "\"Use this stage now\" row",
  "Stage %d is now active (save to use the new values)": "\"Use this stage now\" row",
  "Stage %d is now active": "\"Use this stage now\" row",
  "Unsaved changes": "closing a tab shows the browser's own leave prompt",
  "Write them into the mouse before closing?": "closing a tab shows the browser's own leave prompt",
  "Connected · %d %% · charging": "stale in the catalog: 991cbfc shows the battery on its own line",
  "Connected · %d %%": "stale in the catalog: 991cbfc shows the battery on its own line",
  "Connected · charging": "stale in the catalog: 991cbfc shows the battery on its own line",
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`Keypad ${i + 1}`, "name built in a loop in src/model/tables.ts"])),
  // the redesign (tabs and cards instead of the sidebar and pages)
  "HITS tuning": "redesign: the tab is Click", "Sensor": "redesign: the tab is Aim",
  "HITS CONFIGURATION": "redesign: the Click panel has one card per setting",
  "Rapid": "redesign: no HITS tabs, one card per setting", "Presets": "redesign: presets moved to the Profiles feel library",
  "BUTTONS": "redesign: the panel title is the Buttons tab", "POLLING RATE": "redesign: the Polling rate card", "TRACKING": "redesign: one card per setting on Aim",
  "POWER": "redesign: the Battery life card on Device", "HID++ FEATURES": "redesign: the Developer card on Device",
  // the polish round: one column of cards, control mode and backup on Device, the click test on the mouse
  "ACTION": "redesign: the Action card title", "DPI STAGES": "redesign: the DPI stages card title",
  "LOOK": "redesign: the App card on Device", "BACKUP": "redesign: the Backup card title", "CONTROL MODE": "redesign: the Saved profiles card",
  "Who controls the mouse": "redesign: the \"Use saved profiles\" switch", "Onboard memory (recommended)": "redesign: the \"Use saved profiles\" switch",
  "Host software": "redesign: the \"Use saved profiles\" switch",
  "System default": "redesign: the language picker shows \"Auto · <language>\"",
  "Click a stage to switch the mouse to it now. New DPI values are felt after Save to mouse (Ctrl+S) — the mouse takes DPI only from its memory. ★ = stage after power-on.": "redesign: a shorter hint under the speed animation",
  "L %d · R %d · M %d · Back %d · Fwd %d · %d clicks/s · held %d ms": "redesign: Test clicks shows each number on its own under the mouse",
  "Test here — click with any button": "redesign: Test clicks on the large mouse",
  "DPI-shift layer": "redesign: the layer choice reads \"While DPI shift is held\"",
  "Used while a button set to DPI shift is held": "redesign: the hint under the layer choice names the DPI shift button",
  "Strongest": "redesign: haptics is a row of levels 0..5", "Rotate the mouse": "redesign: rotate by the thumbnail or a sideways drag",
  "EDITING": "redesign: the profile switcher in the top bar", "%s · Active": "redesign: the profile switcher marks the active profile",
  "%s · not active": "redesign: the profile switcher marks the active profile", "Name": "redesign: the name heads the Device panel",
  "Searching for the PRO X3 SUPERSTRIKE — switch the mouse on or plug in the receiver": "redesign: the connect screen replaces the banner",
  "Retry": "redesign: the connect screen replaces the banner",
};

function parsePot(text) {
  const out = [];
  let refs = [], ctx;
  for (const block of text.split(/\r?\n\r?\n/)) {
    refs = [...block.matchAll(/^#: (.+)$/gm)].flatMap((m) => m[1].split(/\s+/)).map((r) => r.replace(/:\d+$/, ""));
    const get = (key) => {
      const m = new RegExp(`^${key} ((?:".*"\\s*)+)`, "m").exec(block);
      return m ? [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join("").replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\") : undefined;
    };
    const id = get("msgid");
    ctx = get("msgctxt");
    if (id) out.push({ id, ctx, plural: get("msgid_plural"), refs });
  }
  return out;
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

// True when the web source has `id` as a quoted string (any quote style, quotes inside escaped).
function usedIn(sources, id) {
  const forms = ['"', "'", "`"].map((q) => q + id.replaceAll("\\", "\\\\").replaceAll(q, "\\" + q).replaceAll("\n", "\\n") + q);
  forms.push(`'${id.replaceAll("\n", "\\n")}'`, `"${id.replaceAll("\n", "\\n")}"`);
  return sources.some((src) => forms.some((f) => src.includes(f)));
}

// English text in JSX children and in UI calls that bypass the catalog.
function rawUiText(files, catalog) {
  const out = [];
  for (const file of files.filter((f) => f.endsWith(".tsx"))) {
    const src = readFileSync(file, "utf8");
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    const checks = [
      [/>\s*([A-Z][^<>{}]*[a-z][^<>{}]*?)\s*</g, "JSX text"],
      [/(?:toast|confirm|prompt|alert)\(\s*["'`]([^"'`]+)["'`]/g, "call"],
      [/(?:title|placeholder|aria-label|label)=\{?"([A-Z][^"]+)"/g, "attribute"],
    ];
    for (const [re, kind] of checks)
      for (const m of src.matchAll(re)) {
        const s = m[1].trim().replace(/\s+/g, " ");
        if (s.length > 2 && !catalog.has(s) && !/\$\{|=>|\breturn\b|^Promise$/.test(s)) out.push({ file: rel, line: src.slice(0, m.index).split("\n").length, kind, text: s });
      }
  }
  return out;
}

const pot = parsePot(readFileSync(join(ROOT, "po/superstrike-studio.pot"), "utf8"));
const files = walk(join(ROOT, "src"));
const sources = files.map((f) => readFileSync(f, "utf8"));
const catalog = new Set(pot.map((e) => e.id));

const unused = pot.filter((e) => !usedIn(sources, e.id));
const byFile = new Map();
for (const e of unused) {
  const key = e.refs.find((r) => r.startsWith("src/")) ?? "(no source)";
  if (!byFile.has(key)) byFile.set(key, []);
  byFile.get(key).push(e);
}

let todo = 0;
console.log(`Native strings: ${pot.length}. Used by the web app: ${pot.length - unused.length}. Not used: ${unused.length}.\n`);
for (const [file, list] of [...byFile].sort()) {
  console.log(file);
  for (const e of list) {
    const why = NOT_PORTED[e.id];
    if (!why) todo++;
    console.log(`  ${why ? "skip" : "TODO"}  ${e.ctx ? `[${e.ctx}] ` : ""}${JSON.stringify(e.id)}${why ? `  (${why})` : ""}`);
  }
}
const raw = rawUiText(files, catalog);
console.log(`\nWeb text not in the catalog (shown untranslated): ${raw.length}`);
for (const r of raw) console.log(`  ${r.file}:${r.line}  ${r.kind}  ${JSON.stringify(r.text)}`);

// New strings the redesign passes through t() / tc(): shown in English until they are added to the catalog.
const fresh = new Map();
for (const file of files.filter((f) => !/[\\/]i18n[\\/]/.test(f))) {
  const src = readFileSync(file, "utf8"), rel = relative(ROOT, file).replaceAll("\\", "/");
  for (const m of src.matchAll(/\bt(?:c\(\s*"[^"]*",)?\(?\s*"((?:[^"\\]|\\.)+)"\s*\)/g)) {
    const id = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    if (!catalog.has(id) && !fresh.has(id)) fresh.set(id, `${rel}:${src.slice(0, m.index).split("\n").length}`);
  }
}
console.log(`\nNew strings through t() not in the catalog yet: ${fresh.size}`);
for (const [id, at] of fresh) console.log(`  ${at}  ${JSON.stringify(id)}`);
console.log(`\nTo do: ${todo} native strings unused without a reason, ${raw.length} untranslated web texts, ${fresh.size} new strings to translate.`);
