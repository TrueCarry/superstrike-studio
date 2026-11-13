import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { f, parsePo } from "./i18n";

const PO_DIR = new URL("../../po/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, PO_DIR), "utf8");

describe("po parser", () => {
  test("contexts, plurals, multi-line strings and fuzzy entries", () => {
    const c = parsePo(`
msgid ""
msgstr ""
"Plural-Forms: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && "
"n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);\\n"

msgctxt "page"
msgid "Buttons"
msgstr "Кнопки"

msgid "Battery"
msgstr "Батарея"

msgid "%d profile"
msgid_plural "%d profiles"
msgstr[0] "%d профиль"
msgstr[1] "%d профиля"
msgstr[2] "%d профилей"

#, fuzzy
msgid "Retry"
msgstr "Повтор"

msgid "Long"
msgstr ""
"first "
"second"
`);
    expect(c.messages.get("page\u0004Buttons")).toEqual(["Кнопки"]);
    expect(c.messages.get("Battery")).toEqual(["Батарея"]);
    expect(c.messages.has("Retry")).toBe(false);
    expect(c.messages.get("Long")).toEqual(["first second"]);
    const forms = c.messages.get("%d profile")!;
    expect([1, 3, 5, 21].map((n) => forms[c.plural(n)])).toEqual(["%d профиль", "%d профиля", "%d профилей", "%d профиль"]);
  });

  test("every catalog parses and keeps its format specifiers", () => {
    const pot = parsePo(read("superstrike-studio.pot"));
    const files = readdirSync(PO_DIR).filter((n) => n.endsWith(".po"));
    expect(files.length).toBe(20);
    for (const name of files) {
      const c = parsePo(read(name));
      expect(c.messages.size).toBeGreaterThan(300);
      for (const [key, forms] of c.messages) {
        const id = key.split("\u0004").pop()!;
        const specs = (s: string) => (s.match(/%(\d+\$)?[0-9.]*[dsxf]/g) ?? []).map((x) => x.replace(/^%\d+\$/, "%")).sort();
        for (const s of forms) if (s) expect([name, key, specs(s)]).toEqual([name, key, specs(id)]);
      }
      expect(c.plural(1)).toBeGreaterThanOrEqual(0);
    }
    expect(pot.messages.size).toBe(0); // the template has no translations
  });
});

describe("f", () => {
  test("printf subset", () => {
    expect(f("%d %% · %s", 46, "charging")).toBe("46 % · charging");
    expect(f("≈ %.1f mm", 0.5)).toBe("≈ 0.5 mm");
    expect(f("Mouse mask 0x%04x", 0x20)).toBe("Mouse mask 0x0020");
    expect(f("%2$s %1$s", "a", "b")).toBe("b a");
  });
});
