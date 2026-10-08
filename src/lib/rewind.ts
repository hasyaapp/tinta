import type { Page } from "./model";
export interface PageHistory {
  undo: Page[];
  redo: Page[];
}
export function historyFrames(history: PageHistory, current: Page): Page[] {
  return [...history.undo, current, ...history.redo.slice().reverse()];
}
/** Snapshot timeline: choosing a point retains both sides until a new edit. */
export function seekHistory(
  history: PageHistory,
  frames: Page[],
  index: number,
): Page {
  const at = Math.max(0, Math.min(frames.length - 1, index));
  history.undo = frames.slice(0, at);
  history.redo = frames.slice(at + 1).reverse();
  return structuredClone(frames[at]);
}
export function angleDelta(previous: number, next: number) {
  let d = next - previous;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
