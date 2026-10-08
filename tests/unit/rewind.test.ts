import { expect, test } from "vitest";
import { angleDelta, historyFrames, seekHistory } from "../../src/lib/rewind";
import { newPage, validateBackup, seedLibrary } from "../../src/lib/model";
test("scrubbing retains the complete past and future, including layers and metadata", () => {
  const a = newPage(),
    b = { ...a, ink: "stroke", note: "note" },
    c = { ...b, background: "#123456" };
  const history = { undo: [a], redo: [c] };
  const frames = historyFrames(history, b);
  expect(frames).toEqual([a, b, c]);
  expect(seekHistory(history, frames, 0)).toEqual(a);
  expect(history.redo).toEqual([c, b]);
  const restored = seekHistory(history, frames, 2);
  expect(restored).toEqual(c);
  restored.note = "changed";
  expect(c.note).toBe("note");
  expect(history.undo).toEqual([a, b]);
  expect(history.redo).toEqual([]);
});
test("Rewind crosses the angle seam in both directions without jumping", () => {
  expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  expect(angleDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
});
test("empty palette slots survive backups and more than 100 custom palettes", () => {
  const l = seedLibrary();
  l.palettes.push(
    ...Array.from({ length: 110 }, () => Array<string>(7).fill("")),
  );
  expect(validateBackup(l).palettes).toEqual(l.palettes);
  l.palettes[0][0] = "invalid";
  expect(() => validateBackup(l)).toThrow();
});
