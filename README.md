<div align="center">

<img src="public/favicon.svg" width="96" alt="">

# SuperStrike Studio Plus

**Tune the Logitech PRO X3 / PRO X2 SUPERSTRIKE from your browser — no install, no G HUB.**

**[Open the app → truecarry.github.io/superstrike-studio](https://truecarry.github.io/superstrike-studio/)**

</div>

Actuation point, rapid trigger and click haptics, button actions, DPI stages, polling rate and
power settings, written into the mouse's onboard memory over [WebHID](https://developer.mozilla.org/docs/Web/API/WebHID_API).
The settings keep working on any computer with the page closed.

This is a browser port of [SuperStrike Studio](https://github.com/Adhamura/superstrike-studio)
by the SuperStrike Studio authors (a native GTK app for Linux, Windows and macOS). The protocol
knowledge, the mouse drawings and the translations come from that project.

> Not affiliated with or endorsed by Logitech. Logitech, G HUB, PRO, LIGHTSPEED and SUPERSTRIKE are
> trademarks of Logitech.

## What it does

| Page | |
|---|---|
| **HITS tuning** | Actuation 1–10, rapid trigger 1–5, haptics 0–5, per button or both · your own presets, built-in presets and 12 published pro-player presets · copy and import G HUB HITS codes · click test pad |
| **Buttons** | Mouse, keyboard (with modifiers, or record a key), media, function (DPI, profiles, scroll, tilt, battery), disabled or factory default · normal and DPI-shift layer |
| **Sensor** | Five DPI stages (X/Y, lift-off distance, default stage) · polling rate for wireless and cable · angle snapping · gaming surface mode · scroll filter · power timers |
| **Profiles** | Five onboard profiles: rename, profile cycle, activate, copy, reset to factory, export/import · onboard or host control mode · whole-memory backup and restore |
| **Device** | Connection, battery, firmware, onboard memory, HID++ feature table, raw HID traffic · language · colours |

21 languages: English, 简体中文, 繁體中文, 日本語, 한국어, Русский, Українська, Español, Português (Brasil),
Français, Deutsch, Italiano, Polski, Türkçe, العربية, हिन्दी, বাংলা, اردو, Bahasa Indonesia, Tiếng Việt, ไทย.

## How it compares

| | **SuperStrike Studio Plus** | SuperStrike Studio | Logitech G HUB |
|---|:--|:--|:--|
| Install | none: a web page | one file per system | installer |
| Linux | ✅ in a Chromium browser | ✅ | ❌ |
| Windows | ✅ in a Chromium browser | ✅ | ✅ |
| macOS | ✅ in a Chromium browser | ✅ | ✅ |
| HITS actuation, rapid trigger, haptics | ✅ | ✅ | ✅ |
| Haptics kept in the onboard profiles | ✅ | ✅ | ❌ ¹ |
| Works with the app closed, no background service | ✅ | ✅ | ➖ onboard mode only |
| Pro presets and HITS codes | ✅ | ✅ | ✅ |
| Demo mouse, to try it without one | ✅ | ✅ | ❌ |
| Account, telemetry | none | none | optional account |
| Updates | not needed: the page is always the latest version | in the app, once a day, can be turned off | background update service |
| Lighting, macros, other Logitech devices | ❌ | ❌ | ✅ |
| Open source | ✅ MIT | ✅ MIT | ❌ |

<sub>✅ yes · ➖ partial · ❌ no. ¹ In tests by the SuperStrike Studio authors with a PRO X3 SUPERSTRIKE.
Firefox and Safari have no WebHID, so SuperStrike Studio Plus needs Chrome, Edge, Brave, Opera or
another Chromium browser. G HUB is a much bigger product for the whole Logitech line-up; both
SuperStrike apps do one mouse. Corrections are welcome in an issue.</sub>

## Requirements

- **Chrome, Edge, Brave, Opera** or another Chromium browser, in a normal window. Firefox and Safari
  have no WebHID.
- The mouse on its LIGHTSPEED receiver or on its cable. Pick **USB Receiver** when the browser asks;
  it remembers the choice.
- **Close Logitech G HUB** (also in the tray / menu bar) — it can keep the receiver busy.

**Linux:** your user needs access to the receiver. Add a udev rule once, then replug the receiver:

```sh
echo 'KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="046d", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/70-superstrike.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

**Windows:** nothing to set up. **macOS:** if macOS asks for Input Monitoring, allow it for the browser.

## Saving and safety

Changes are a preview until **Save to mouse** (Ctrl+S); HITS changes on the active profile are felt
at once. When saving:

- every memory sector is written with its CRC and read back to verify it;
- a backup of the whole memory is kept in the browser before the first save of each visit and
  before every restore (Profiles → Backup), and can be downloaded;
- if no button would send a left click any more, the app asks first.

A mouse that never had profiles saved runs on its built-in factory profile, which can not be changed.
The app shows this, and the first save creates the five onboard profiles (Profile 1 with your
changes, the others as factory copies), like G HUB does.

Nothing leaves your computer: the page only talks to the mouse, and presets, backups and the
language choice stay in the browser's local storage.

## Development

Needs [Bun](https://bun.sh).

```sh
bun install
bun run dev      # http://127.0.0.1:8017
bun test         # profile format, HITS codes, translations
bun run build    # static site in dist/, works from any folder (hash routes)
```

Every push to `main` is tested, built and published to GitHub Pages by
[.github/workflows/pages.yml](.github/workflows/pages.yml).

| Path | |
|---|---|
| `src/hid/` | HID++ 2.0 over WebHID: framing, request queue, device features, memory sectors |
| `src/model/` | Onboard profile format, button actions, directory, HITS codes, backups |
| `src/state/store.ts` | App state and every action that talks to the mouse |
| `src/pages/`, `src/components/` | React UI (React Router), mouse drawing, controls |
| `src/i18n/` | gettext catalogs loader: `t()`, `tc()` (context), `tn()` (plural), `f()` (printf) |
| `po/` | Translations (`.po`, one per language) and the template `superstrike-studio.pot` |
| `public/hid-test.html` | The first single-file HITS test page |

### Translations

The catalogs in `po/` are standard gettext files from SuperStrike Studio. UI text goes through
`t("English text")` (or `tc("context", …)` where upstream uses a context) and is looked up by its
exact English text; a string without a translation shows in English. A few texts that only the
web app has are English for now — add them to the `.po` files to translate them.

## License

MIT — see [LICENSE](LICENSE). Copyright © 2026 TrueCarry and thekiba. Based on SuperStrike Studio,
copyright © 2026 The SuperStrike Studio authors, under the same license.
