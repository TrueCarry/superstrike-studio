import { describe, expect, test } from "bun:test";
import { DIR_SECTOR, encodeProfile, parseDirectory, parseProfile } from "../model/profile";
import { Device, F } from "./device";
import { demoDevice } from "./sim";

const open = () => Device.open(demoDevice());

describe("demo mouse", () => {
  test("opens on receiver slot 1 with HITS", async () => {
    const d = await open();
    expect(d.index).toBe(1);
    expect(d.name).toBe("PRO X3 SUPERSTRIKE");
    expect(await d.feature(F.HITS)).toBeGreaterThan(0);
  });

  test("has the five screenshot profiles, all in the cycle", async () => {
    const d = await open();
    const dir = parseDirectory(await d.readSector(DIR_SECTOR));
    expect(dir.map((e) => e.sector)).toEqual([1, 2, 3, 4, 5]);
    const names = [];
    for (const e of dir) names.push(parseProfile(e.sector, await d.readSector(e.sector)).name);
    expect(names).toEqual(["Tactical FPS", "Arena FPS", "Battle royale", "MMO / MOBA", "Desktop"]);
  });

  test("keeps sector writes and profile switches", async () => {
    const d = await open();
    const p = parseProfile(2, await d.readSector(2));
    p.name = "Renamed";
    await d.writeSector(2, encodeProfile(p));
    expect(parseProfile(2, await d.readSector(2)).name).toBe("Renamed");
    await d.setCurrentProfile(2);
    expect(await d.currentProfile()).toBe(2);
  });

  test("HITS values round trip", async () => {
    const d = await open();
    const h = { ...(await d.hitsGet(0)), act: 7 };
    await d.hitsSet(0, h);
    expect(await d.hitsGet(0)).toEqual(h);
  });

  test("takes DPI and report rate live", async () => {
    const d = await open();
    await d.dpiSet(1250, 1300, 2);
    await d.rateSet(3);
    expect(await d.rateGet()).toBe(3);
  });
});
