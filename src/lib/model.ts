export type Tool =
  | "erase"
  | "blend"
  | "draw"
  | "sketch"
  | "marker"
  | "write"
  | "color"
  | "diagram"
  | "cut"
  | "fill"
  | "collage"
  | "canvas-roll";
export type BrushSize = "sm" | "md" | "lg";
export interface Photo {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
export interface Page {
  id: string;
  width: number;
  height: number;
  ink: string;
  fill: string;
  background: string;
  template: string;
  photos: Photo[];
  note: string;
  thumbnail: string;
}
export interface Journal {
  id: string;
  title: string;
  cover: string;
  band: string;
  pageIds: string[];
  template: string;
  lastPage: number;
  updatedAt?: number;
  lock?: { salt: string; hash: string };
}
export interface Settings {
  fingerDraw: boolean;
  cleanCanvas: boolean;
  exportBackground: boolean;
  showGrid: boolean;
}
export interface Clip {
  id: string;
  src: string;
  width: number;
  height: number;
}
export interface Library {
  version: 1;
  journals: Journal[];
  pages: Record<string, Page>;
  palettes: string[][];
  clips: Clip[];
  templates: { id: string; src: string }[];
  settings: Settings;
  selected: number;
}
export const asset = (name: string) =>
  import.meta.env.BASE_URL + "art/" + name + ".svg";
export const uid = () => crypto.randomUUID();
export const paletteDefaults = [
  ["#173d4a", "#ed5340", "#ffba3b", "#f9ebc4", "#6f9766", "#a8c6c1", "#ffffff"],
  ["#202932", "#4b6584", "#778ca3", "#a5b1c2", "#d1d8e0", "#eeeeee", "#ffffff"],
  ["#7f3a3b", "#c45c58", "#e29c87", "#efc7a4", "#a88261", "#65534a", "#ede2cf"],
  ["#36364b", "#6a547e", "#927aac", "#ba9bbb", "#d4b7bd", "#ecd1c8", "#fff2df"],
  ["#163f3b", "#327a6a", "#65a491", "#9fc2a4", "#d5db9b", "#e9bf56", "#f0e7cf"],
  Array<string>(7).fill(""),
  Array<string>(7).fill(""),
];
export const tools: {
  id: Tool;
  label: string;
  key?: string;
  sized?: boolean;
}[] = [
  { id: "erase", label: "Eraser", key: "E", sized: true },
  { id: "blend", label: "Blend", key: "B", sized: true },
  { id: "draw", label: "Fountain Pen", key: "P", sized: true },
  { id: "sketch", label: "Pencil", key: "S", sized: true },
  { id: "marker", label: "Marker", key: "M", sized: true },
  { id: "write", label: "Felt Pen", key: "W", sized: true },
  { id: "color", label: "Watercolor", key: "A", sized: true },
  { id: "diagram", label: "Diagram", key: "D", sized: true },
  { id: "cut", label: "Cut", key: "L" },
  { id: "fill", label: "Fill", key: "F" },
  { id: "collage", label: "Collage" },
  { id: "canvas-roll", label: "Templates" },
];
export const templateNames = [
  "grid-graph",
  "grid-line",
  "grid-dot",
  "storyboard-1x1",
  "storyboard-2x2",
  "storyboard-3x2",
  "comic-1-panel",
  "comic-2-panels",
  "comic-3-panels",
  "comic-4-panels",
  "comic-5-panels",
  "comic-6-panels",
  "writing-lined",
  "writing-checklist",
  "writing-notecard",
  "writing-penmanship",
  "perspective-isometric",
  "perspective-oblique",
  "perspective-1-point",
  "perspective-2-points",
  "planner-week",
  "planner-month",
  "planner-timeline",
  "device-phone",
  "device-tablet",
  "device-window",
];
export const templateLabel = (name: string) =>
  (
    ({
      "grid-graph": "Graph",
      "grid-line": "Line Grid",
      "grid-dot": "Dot Grid",
      "storyboard-1x1": "1-Panel Storyboard",
      "storyboard-2x2": "4-Panel Storyboard",
      "storyboard-3x2": "6-Panel Storyboard",
    }) as Record<string, string>
  )[name] || name.replaceAll("-", " ");
export const templateAsset = (name: string, width: number, height: number) =>
  /^data:image\/(png|jpeg|webp);base64,/.test(name)
    ? name
    : asset(
        "journal-templates-" +
          (height > width ? "portrait" : "landscape") +
          "-" +
          name,
      );
export const coverNames = [
  "geometric",
  "gradient",
  "patterns",
  "student",
  "default",
].flatMap((group) =>
  Array.from({ length: 8 }, (_, i) => "covers-" + group + "-" + (i + 1)),
);
export function newPage(template = ""): Page {
  return {
    id: uid(),
    width: 1376,
    height: 1032,
    ink: "",
    fill: "",
    background: "#f8f7f2",
    template,
    photos: [],
    note: "",
    thumbnail: "",
  };
}
export function newJournal(
  title = "Untitled Journal",
  cover = asset("covers-geometric-1"),
): Journal {
  return {
    id: uid(),
    title,
    cover,
    band: "#23303f",
    pageIds: [],
    template: "",
    lastPage: 0,
  };
}
export function seedLibrary(): Library {
  const pages: Record<string, Page> = {};
  const names = [
    "Little Things",
    "Field Notes",
    "Design Project",
    "Everyday Ideas",
    "Welcome",
  ];
  const covers = [
    "covers-student-3",
    "covers-patterns-2",
    "covers-geometric-5",
    "covers-gradient-5",
    "covers-default-5",
  ];
  const counts = [2, 2, 4, 2, 6];
  const welcomeNote = [
    "Welcome to Tinta!",
    "",
    "Grab a brush and make a mark. Strokes follow the speed of your hand.",
    "",
    "• Rewind: took a wrong turn? Scrub back through time with two fingers.",
    "• Mixer: blend any two colors into a shade that is all yours.",
    "• Export: when a page feels ready, send it out as an image.",
    "",
    "The next pages hold a few paper templates. This journal is yours, so draw over everything.",
  ].join("\n");
  const welcomeTemplates = ["", "grid-dot", "writing-lined", "storyboard-2x2"];
  const journals = names.map((name, i) => {
    const j = newJournal(name, asset(covers[i]));
    j.band = ["#cf8d61", "#39494b", "#c45458", "#d9c2bc", "#139770"][i];
    for (let n = 0; n < counts[i]; n++) {
      const p = newPage(name === "Welcome" ? (welcomeTemplates[n] ?? "") : "");
      if (name === "Welcome" && n === 0) p.note = welcomeNote;
      pages[p.id] = p;
      j.pageIds.push(p.id);
    }
    return j;
  });
  return {
    version: 1,
    journals,
    pages,
    palettes: structuredClone(paletteDefaults),
    clips: [],
    templates: [],
    settings: {
      fingerDraw: true,
      cleanCanvas: false,
      exportBackground: true,
      showGrid: false,
    },
    selected: 2,
  };
}
export function duplicatePage(page: Page): Page {
  return {
    ...structuredClone(page),
    id: uid(),
    photos: page.photos.map((p) => ({ ...p, id: uid() })),
  };
}
export function movePages(
  lib: Library,
  ids: string[],
  sourceId: string,
  destinationId: string,
): Library {
  if (
    sourceId === destinationId ||
    !lib.journals.some((j) => j.id === destinationId)
  )
    return lib;
  const source = lib.journals.find((j) => j.id === sourceId);
  const ordered = source?.pageIds.filter((id) => ids.includes(id)) ?? [];
  return {
    ...lib,
    journals: lib.journals.map((j) =>
      j.id === sourceId
        ? {
            ...j,
            pageIds: j.pageIds.filter((id) => !ordered.includes(id)),
            lastPage: 0,
          }
        : j.id === destinationId
          ? { ...j, pageIds: [...j.pageIds, ...ordered] }
          : j,
    ),
  };
}
export function validateBackup(input: unknown): Library {
  const l = input as Library;
  if (
    !l ||
    l.version !== 1 ||
    !Array.isArray(l.journals) ||
    !l.pages ||
    !Array.isArray(l.palettes) ||
    !l.settings
  )
    throw new Error("This is not a Tinta backup.");
  if (
    !Number.isInteger(l.selected) ||
    l.selected < 0 ||
    l.selected >= Math.max(1, l.journals.length) ||
    !["fingerDraw", "cleanCanvas", "exportBackground", "showGrid"].every(
      (k) =>
        typeof (l.settings as unknown as Record<string, unknown>)[k] ===
        "boolean",
    )
  )
    throw new Error("Invalid library settings.");
  if (l.journals.length > 1000 || Object.keys(l.pages).length > 10000)
    throw new Error("This backup is too large.");
  const seen = new Set<string>();
  const safe = (s: unknown) =>
    typeof s === "string" &&
    (s === "" ||
      /^data:image\/(png|jpeg|webp);base64,/.test(s) ||
      (/^[\w./-]+$/.test(s) && !s.includes("..") && !s.startsWith("//")));
  for (const j of l.journals) {
    if (
      typeof j.id !== "string" ||
      seen.has(j.id) ||
      typeof j.title !== "string" ||
      !Array.isArray(j.pageIds) ||
      !safe(j.cover) ||
      !/^#[0-9a-f]{6}$/i.test(j.band) ||
      typeof j.template !== "string" ||
      !Number.isInteger(j.lastPage) ||
      j.lastPage < 0 ||
      (j.lock &&
        (!/^[0-9a-f]{64}$/i.test(j.lock.hash) ||
          typeof j.lock.salt !== "string"))
    )
      throw new Error("Invalid journal in backup.");
    seen.add(j.id);
    for (const id of j.pageIds) {
      const p = Object.hasOwn(l.pages, id) && l.pages[id];
      if (
        !p ||
        seen.has(id) ||
        p.id !== id ||
        !Number.isInteger(p.width) ||
        !Number.isInteger(p.height) ||
        p.width < 1 ||
        p.height < 1 ||
        p.width > 8192 ||
        p.height > 8192 ||
        !Array.isArray(p.photos) ||
        !safe(p.ink) ||
        !safe(p.fill) ||
        !safe(p.thumbnail) ||
        typeof p.note !== "string" ||
        typeof p.template !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(p.background)
      )
        throw new Error("Invalid page in backup.");
      if (
        !p.photos.every(
          (x) =>
            typeof x.id === "string" &&
            safe(x.src) &&
            x.width > 0 &&
            x.height > 0 &&
            [x.x, x.y, x.width, x.height, x.rotation].every(Number.isFinite),
        )
      )
        throw new Error("Invalid image in backup.");
      seen.add(id);
    }
  }
  if (
    l.palettes.length < 1 ||
    !l.palettes.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 7 &&
        p.every((c) => c === "" || /^#[0-9a-f]{6}$/i.test(c)),
    )
  )
    throw new Error("Invalid color palettes.");
  if (
    !Array.isArray(l.clips) ||
    !l.clips.every(
      (c) =>
        typeof c.id === "string" &&
        safe(c.src) &&
        Number.isFinite(c.width) &&
        Number.isFinite(c.height) &&
        c.width > 0 &&
        c.height > 0,
    ) ||
    !Array.isArray(l.templates) ||
    !l.templates.every((t) => typeof t.id === "string" && safe(t.src))
  )
    throw new Error("Invalid library assets.");
  if (Object.keys(l.pages).some((id) => !seen.has(id)))
    throw new Error("Backup contains unassigned pages.");
  return l;
}
export function journalBackup(l: Library, journalId: string): Library {
  const journal = l.journals.find((j) => j.id === journalId);
  if (!journal) throw new Error("Journal not found.");
  const pages: Record<string, Page> = {};
  for (const id of journal.pageIds) pages[id] = l.pages[id];
  const used = new Set(
    [journal.template, ...journal.pageIds.map((id) => l.pages[id].template)],
  );
  return structuredClone({
    version: 1,
    journals: [journal],
    pages,
    palettes: l.palettes,
    clips: [],
    templates: l.templates.filter((t) => used.has(t.id)),
    settings: l.settings,
    selected: 0,
  });
}
export function mergeBackup(l: Library, incoming: Library): Library {
  const pages = { ...l.pages };
  const templates = [...l.templates];
  const renamedTemplates = new Map<string, string>();
  for (const t of incoming.templates) {
    const existing = l.templates.find((x) => x.id === t.id);
    if (existing?.src === t.src) continue;
    const id = existing ? uid() : t.id;
    if (existing) renamedTemplates.set(t.id, id);
    templates.push({ id, src: t.src });
  }
  const journalIds = new Set(l.journals.map((j) => j.id));
  const added = incoming.journals.map((j) => {
    const copy: Journal = {
      ...structuredClone(j),
      id: journalIds.has(j.id) ? uid() : j.id,
      template: renamedTemplates.get(j.template) ?? j.template,
      pageIds: [],
      updatedAt: Date.now(),
    };
    for (const id of j.pageIds) {
      const source = incoming.pages[id];
      const p = Object.hasOwn(pages, id)
        ? duplicatePage(source)
        : structuredClone(source);
      p.template = renamedTemplates.get(p.template) ?? p.template;
      pages[p.id] = p;
      copy.pageIds.push(p.id);
    }
    return copy;
  });
  return {
    ...l,
    journals: [...l.journals, ...added],
    pages,
    templates,
    selected: l.journals.length,
  };
}
export async function pinHash(pin: string, salt: string) {
  const d = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(salt + pin),
  );
  return Array.from(new Uint8Array(d), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
