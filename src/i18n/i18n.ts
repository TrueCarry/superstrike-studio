// Translations from the gettext catalogs in po/ (one .po file per language), loaded on demand.
//   t("text")             translate          tc("ctx", "text")  translate with context
//   tn("one", "many", n)  plural forms       f(t("… %d …"), n)  printf-style values (%d %s %.1f %04x, %1$s)
import { useSyncExternalStore } from "react";

export interface Language {
  code: string;
  native: string;
}

/** Native names, never translated. English is the source language. */
export const LANGUAGES: Language[] = [
  { code: "en", native: "English" }, { code: "zh_CN", native: "简体中文" }, { code: "zh_TW", native: "繁體中文（台灣）" },
  { code: "ja", native: "日本語" }, { code: "ko", native: "한국어" }, { code: "ru", native: "Русский" },
  { code: "uk", native: "Українська" }, { code: "es", native: "Español" }, { code: "pt_BR", native: "Português (Brasil)" },
  { code: "fr", native: "Français" }, { code: "de", native: "Deutsch" }, { code: "it", native: "Italiano" },
  { code: "pl", native: "Polski" }, { code: "tr", native: "Türkçe" }, { code: "ar", native: "العربية" },
  { code: "hi", native: "हिन्दी" }, { code: "bn", native: "বাংলা" }, { code: "ur", native: "اردو" },
  { code: "id", native: "Bahasa Indonesia" }, { code: "vi", native: "Tiếng Việt" }, { code: "th", native: "ไทย" },
];
const RTL = new Set(["ar", "ur", "fa", "he"]);
const EOT = "\u0004"; // gettext separator between context and message id

interface Catalog {
  messages: Map<string, string[]>;
  plural: (n: number) => number;
}

// ---------------------------------------------------------------- .po parsing

function unquote(s: string): string {
  return s.replace(/\\(["\\nt])/g, (_, c: string) => ({ n: "\n", t: "\t" })[c] ?? c);
}

/** Compiles a Plural-Forms expression. Only C-style arithmetic on n is accepted. */
function compilePlural(header: string): (n: number) => number {
  const m = /plural=([^;]+)/.exec(header);
  if (!m || !/^[n0-9\s()?:<>=!&|%+-]+$/.test(m[1])) return (n) => (n === 1 ? 0 : 1);
  const fn = new Function("n", `return Number(${m[1]});`) as (n: number) => number;
  return (n) => fn(n) || 0;
}

export function parsePo(text: string): Catalog {
  const messages = new Map<string, string[]>();
  let header = "";
  let entry: { ctx?: string; id?: string; plural?: string; str: string[]; fuzzy: boolean } = { str: [], fuzzy: false };
  let field: { name: string; index: number } | null = null;

  const flush = () => {
    if (entry.id === "") header = entry.str[0] ?? "";
    else if (entry.id !== undefined && !entry.fuzzy && entry.str.some((s) => s)) {
      messages.set(entry.ctx !== undefined ? entry.ctx + EOT + entry.id : entry.id, entry.str);
    }
    entry = { str: [], fuzzy: false };
    field = null;
  };
  const append = (value: string) => {
    if (!field) return;
    if (field.name === "msgctxt") entry.ctx = (entry.ctx ?? "") + value;
    else if (field.name === "msgid") entry.id = (entry.id ?? "") + value;
    else if (field.name === "msgid_plural") entry.plural = (entry.plural ?? "") + value;
    else entry.str[field.index] = (entry.str[field.index] ?? "") + value;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // An entry ends when the next one starts: a comment, msgctxt or msgid after its msgstr.
    const done = entry.str.length > 0;
    if (line.startsWith("#")) {
      if (done) flush();
      if (line.startsWith("#,") && line.includes("fuzzy")) entry.fuzzy = true;
      continue;
    }
    const m = /^(msgctxt|msgid_plural|msgid|msgstr)(?:\[(\d+)\])?\s+"(.*)"$/.exec(line);
    if (m) {
      if (done && (m[1] === "msgctxt" || m[1] === "msgid")) flush();
      field = { name: m[1], index: Number(m[2] ?? 0) };
      if (m[1] === "msgid" && entry.id === undefined) entry.id = "";
      append(unquote(m[3]));
    } else if (line.startsWith('"') && line.endsWith('"')) {
      append(unquote(line.slice(1, -1)));
    }
  }
  flush();
  return { messages, plural: compilePlural(header) };
}

// ---------------------------------------------------------------- state

let catalog: Catalog | null = null;
let current = "en";
let choice = "system"; // what the user picked: "system" or a language code
const listeners = new Set<() => void>();
const LANG_KEY = "superstrike.lang";

const loaders = () => import.meta.glob<string>("../../po/*.po", { query: "?raw", import: "default" });

/** Best language for the browser's preferences, or "en". */
export function systemLanguage(prefs: readonly string[] = navigator.languages ?? [navigator.language]): string {
  const codes = LANGUAGES.map((l) => l.code);
  for (const p of prefs) {
    const tag = p.replace("-", "_");
    const [base, region] = tag.split("_");
    if (base === "zh") {
      const traditional = /^(TW|HK|MO|Hant)/i.test(region ?? "") || /Hant/i.test(p);
      return traditional ? "zh_TW" : "zh_CN";
    }
    if (codes.includes(tag)) return tag;
    if (base === "pt") return "pt_BR";
    if (codes.includes(base)) return base;
  }
  return "en";
}

/** Switches the UI language ("system" follows the browser). Resolves once the catalog is loaded. */
export async function setLanguage(pick: string, remember = true): Promise<void> {
  const code = pick === "system" ? systemLanguage() : pick;
  let next: Catalog | null = null;
  if (code !== "en") {
    const load = loaders()[`../../po/${code}.po`];
    if (load) next = parsePo(await load());
  }
  catalog = next;
  current = next || code === "en" ? code : "en";
  choice = pick;
  try {
    if (remember) localStorage.setItem(LANG_KEY, pick);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
  document.documentElement.lang = current.replace("_", "-");
  document.documentElement.dir = RTL.has(current) ? "rtl" : "ltr";
  listeners.forEach((l) => l());
}

/** `?lang=ja` in the URL shows that language for this visit only (README screenshots). */
export function initLanguage(): Promise<void> {
  const forced = new URLSearchParams(location.search).get("lang");
  if (forced && LANGUAGES.some((l) => l.code === forced)) return setLanguage(forced, false);
  let saved = "system";
  try {
    saved = localStorage.getItem(LANG_KEY) ?? "system";
  } catch {
    /* ignore */
  }
  return setLanguage(saved).catch(() => setLanguage("en"));
}

/** Current language code and the user's choice; components re-render when it changes. */
export function useLanguage(): { code: string; choice: string } {
  const code = useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => current);
  return { code, choice };
}

// ---------------------------------------------------------------- lookup

export function t(msgid: string): string {
  return catalog?.messages.get(msgid)?.[0] || msgid;
}

export function tc(ctx: string, msgid: string): string {
  return catalog?.messages.get(ctx + EOT + msgid)?.[0] || msgid;
}

export function tn(one: string, many: string, n: number): string {
  const forms = catalog?.messages.get(one);
  if (forms) {
    const s = forms[catalog!.plural(n)];
    if (s) return s;
  }
  return n === 1 ? one : many;
}

/** printf for translated strings: %d %i %s %x %X %f with flags/width/precision, %% and positional %1$s. */
export function f(template: string, ...args: unknown[]): string {
  let next = 0;
  return template.replace(/%(?:(\d+)\$)?([0 -]*)(\d+)?(?:\.(\d+))?([disxXf%])/g, (_, pos: string | undefined, flags: string, width: string | undefined, prec: string | undefined, conv: string) => {
    if (conv === "%") return "%";
    const v = args[pos ? Number(pos) - 1 : next++];
    let s: string;
    switch (conv) {
      case "d":
      case "i":
        s = String(Math.trunc(Number(v)));
        break;
      case "x":
        s = (Number(v) >>> 0).toString(16);
        break;
      case "X":
        s = (Number(v) >>> 0).toString(16).toUpperCase();
        break;
      case "f":
        s = Number(v).toFixed(prec ? Number(prec) : 6);
        break;
      default:
        s = String(v);
    }
    const w = width ? Number(width) : 0;
    if (s.length < w) s = flags.includes("-") ? s.padEnd(w) : s.padStart(w, flags.includes("0") && conv !== "s" ? "0" : " ");
    return s;
  });
}
