import { describe, expect, test } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  seedLibrary,
  duplicatePage,
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
      }
    }
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
