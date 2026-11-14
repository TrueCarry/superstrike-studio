# Developing SuperStrike Studio Plus

Needs [Bun](https://bun.sh).

```sh
bun install
bun run dev            # http://127.0.0.1:8017 (add ?demo for the demo mouse)
bun test               # profile format, HITS codes, demo mouse, translations
bun run build          # static site in dist/, works from any folder (hash routes)
bun run illustrations  # README animations, into docs/illustrations/
```

Every push to `main` is tested, built and published to GitHub Pages by
[.github/workflows/pages.yml](.github/workflows/pages.yml).

## Layout

| Path | |
|---|---|
| `src/hid/` | HID++ 2.0 over WebHID: framing, request queue, device features, memory sectors, demo mouse |
| `src/model/` | Onboard profile format, button actions, directory, HITS codes, backups |
| `src/state/store.ts` | App state and every action that talks to the mouse |
| `src/pages/`, `src/components/` | React UI (React Router), mouse drawing, controls |
| `src/i18n/` | gettext catalogs loader: `t()`, `tc()` (context), `tn()` (plural), `f()` (printf) |
| `po/` | Translations (`.po`, one per language) and the template `superstrike-studio.pot` |
| `tools/parity/` | Screenshot and string comparison against the native app |
| `tools/readme/` | README animations, drawn on the app's mouse pictures |

## Translations

UI text goes through `t("English text")` (or `tc("context", …)`) and is looked up in the gettext
catalogs in `po/` by its exact English text; a string without a translation shows in English.
