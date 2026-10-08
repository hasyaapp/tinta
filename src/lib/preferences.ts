import { tools, type Tool, type BrushSize } from "./model";
export interface CanvasPreferences {
  tool: Tool;
  sizes: Partial<Record<Tool, BrushSize>>;
  palette: number;
  swatch: number;
  trayVisible: boolean;
}
const defaults: CanvasPreferences = {
  tool: "draw",
  sizes: {},
  palette: 0,
  swatch: 0,
  trayVisible: true,
};
export function readCanvasPreferences(): CanvasPreferences {
  try {
    const value = JSON.parse(
      localStorage.getItem("paper-canvas-preferences") || "null",
    );
    if (!value || !tools.some((t) => t.id === value.tool)) return defaults;
    return {
      tool: value.tool,
      sizes: Object.fromEntries(
        Object.entries(value.sizes || {}).filter(
          ([t, s]) =>
            tools.some((x) => x.id === t) &&
            ["sm", "md", "lg"].includes(s as string),
        ),
      ),
      palette:
        Number.isInteger(value.palette) && value.palette >= 0
          ? value.palette
          : 0,
      swatch:
        Number.isInteger(value.swatch) && value.swatch >= 0 && value.swatch < 7
          ? value.swatch
          : 0,
      trayVisible: value.trayVisible !== false,
    };
  } catch {
    return defaults;
  }
}
export function saveCanvasPreferences(p: CanvasPreferences) {
  try {
    localStorage.setItem("paper-canvas-preferences", JSON.stringify(p));
  } catch {
    /* Journals remain available when preference storage is restricted. */
  }
}
