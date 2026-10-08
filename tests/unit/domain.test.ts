import { describe, expect, test } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  seedLibrary,
  duplicatePage,
  journalBackup,
  mergeBackup,
  movePages,
  validateBackup,
  asset,
  coverNames,
  templateNames,
} from "../../src/lib/model";
import { floodMask, recognize } from "../../src/engine/geometry";
import { mixColors, hsvToHex, hexToHSV } from "../../src/lib/color";

describe("journal integrity", () => {
  test("every bundled seed asset resolves", () => {
    const l = seedLibrary();
    for (const j of l.journals) {
      expect(existsSync("public" + j.cover), j.cover).toBe(true);
      for (const id of j.pageIds) {
        const p = l.pages[id];
        for (const s of [p.ink, p.fill])
          if (s) expect(existsSync("public" + s), s).toBe(true);
        if (p.template)
          expect(templateNames.includes(p.template), p.template).toBe(true);
      }
    }
    const welcome = l.journals.find((j) => j.title === "Welcome")!;
    expect(l.pages[welcome.pageIds[0]].note).toContain("Welcome");
    expect(
      welcome.pageIds.filter((id) => l.pages[id].template).length,
    ).toBeGreaterThanOrEqual(3);
    for (const c of coverNames)
      expect(existsSync("public" + asset(c)), c).toBe(true);
    for (const t of templateNames)
      for (const folder of ["thumbnails", "landscape", "portrait"])
        expect(
          existsSync("public" + asset("journal-templates-" + folder + "-" + t)),
          t,
        ).toBe(true);
  });
  test("duplicate isolates page and photo identities", () => {
    const p = Object.values(seedLibrary().pages)[0];
    p.photos.push({
      id: "image",
      src: "",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rotation: 0,
    });
    const copy = duplicatePage(p);
    expect(copy.id).not.toBe(p.id);
    expect(copy.photos[0].id).not.toBe("image");
    copy.photos[0].x = 99;
    expect(p.photos[0].x).toBe(0);
  });
  test("cross-journal move preserves source order and owns every page once", () => {
    const l = seedLibrary(),
      source = l.journals[2],
      dest = l.journals[0],
      ids = [source.pageIds[2], source.pageIds[0]];
    const moved = movePages(l, ids, source.id, dest.id);
    expect(moved.journals[0].pageIds.slice(-2)).toEqual([ids[1], ids[0]]);
    expect(moved.journals[2].pageIds).not.toContain(ids[0]);
    expect(moved.pages).toBe(l.pages);
    expect(new Set(moved.journals.flatMap((j) => j.pageIds)).size).toBe(
      Object.keys(l.pages).length,
    );
    expect(validateBackup(moved)).toBe(moved);
  });
  test("backup rejects duplicate ownership and external image loads", () => {
    const a = seedLibrary();
    a.journals[0].pageIds.push(a.journals[1].pageIds[0]);
    expect(() => validateBackup(a)).toThrow();
    const b = seedLibrary();
    Object.values(b.pages)[0].ink = "https://untrusted.example/track";
    expect(() => validateBackup(b)).toThrow();
  });
  test("journal export validates and round-trips as a merged copy", () => {
    const l = seedLibrary();
    l.templates.push({ id: "custom", src: asset("covers-default-1") });
    const j = l.journals[2];
    l.pages[j.pageIds[0]].template = "custom";
    const payload = validateBackup(
      JSON.parse(JSON.stringify(journalBackup(l, j.id))),
    );
    expect(payload.journals).toHaveLength(1);
    expect(Object.keys(payload.pages)).toEqual(j.pageIds);
    expect(payload.templates).toEqual([l.templates[0]]);
    const merged = mergeBackup(l, payload);
    expect(merged.journals).toHaveLength(l.journals.length + 1);
    const copy = merged.journals.at(-1)!;
    expect(copy.id).not.toBe(j.id);
    expect(copy.pageIds).toHaveLength(j.pageIds.length);
    for (const id of copy.pageIds) expect(j.pageIds).not.toContain(id);
    const owners = merged.journals.flatMap((x) => x.pageIds);
    expect(new Set(owners).size).toBe(owners.length);
    expect(owners.length).toBe(Object.keys(merged.pages).length);
    expect(merged.selected).toBe(merged.journals.indexOf(copy));
    expect(validateBackup(merged)).toBe(merged);
  });
  test("merge keeps ids without collisions and remaps clashing templates", () => {
    const target = seedLibrary();
    const source = seedLibrary();
    source.templates.push({ id: "custom", src: asset("covers-default-2") });
    target.templates.push({ id: "custom", src: asset("covers-default-3") });
    const j = source.journals[0];
    source.pages[j.pageIds[1]].template = "custom";
    const payload = journalBackup(source, j.id);
    const merged = mergeBackup(target, payload);
    const copy = merged.journals.at(-1)!;
    expect(copy.id).toBe(j.id);
    expect(copy.pageIds).toEqual(j.pageIds);
    const remapped = merged.pages[copy.pageIds[1]].template;
    expect(remapped).not.toBe("custom");
    expect(merged.templates.find((t) => t.id === remapped)?.src).toBe(
      asset("covers-default-2"),
    );
    expect(merged.templates.find((t) => t.id === "custom")?.src).toBe(
      asset("covers-default-3"),
    );
    expect(merged.palettes).toBe(target.palettes);
    expect(merged.settings).toBe(target.settings);
    expect(validateBackup(merged)).toBe(merged);
  });
});
describe("drawing primitives", () => {
  test("flood fill stays inside barriers including image edges", () => {
    const pixels = new Uint8ClampedArray(5 * 3 * 4).fill(255);
    for (let y = 0; y < 3; y++) {
      const i = (y * 5 + 2) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
    }
    const mask = floodMask(pixels, 5, 3, 0, 0);
    expect(
      Array.from(mask).filter((v, i) => i % 4 === 3 && v === 255),
    ).toHaveLength(6);
    expect(mask[(0 * 5 + 4) * 4 + 3]).toBe(0);
    expect(floodMask(pixels, 5, 3, -1, 0).some(Boolean)).toBe(false);
  });
  test("diagram recognizes open line and closed rectangle", () => {
    expect(
      recognize([
        { x: 0, y: 0 },
        { x: 50, y: 20 },
        { x: 100, y: 40 },
      ]),
    ).toBe("line");
    expect(
      recognize([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 0, y: 0 },
      ]),
    ).toBe("rectangle");
  });
  test("color conversion preserves colors and mixer endpoints", () => {
    for (const hex of ["#173d4a", "#ffffff", "#000000", "#ff0000"]) {
      const hsv = hexToHSV(hex);
      expect(hsvToHex(...hsv)).toBe(hex);
    }
    expect(mixColors("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixColors("#000000", "#ffffff", 1)).toBe("#ffffff");
  });
});
