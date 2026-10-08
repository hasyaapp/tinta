import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Maximize, Plus, X } from "lucide-react";
import type { BrushSize, Clip, Library, Page, Photo, Tool } from "../lib/model";
import { tools, uid } from "../lib/model";
import { canvas, composePage, fileImage, loadImage } from "../lib/images";
import {
  readCanvasPreferences,
  saveCanvasPreferences,
} from "../lib/preferences";
import { bounds, floodMask, polygon, recognize } from "../engine/geometry";
import type { Point } from "../engine/geometry";
import { InkEngine } from "../engine/InkEngine";
import type { Sample } from "../engine/InkEngine";
import { Icon, IconButton } from "./UI";
import ColorPanel from "./ColorPanel";
import TemplateStrip from "./TemplateStrip";
import RewindDial from "./RewindDial";
import TranscribeDialog from "./TranscribeDialog";
import { historyFrames, seekHistory } from "../lib/rewind";
import CanvasHeader from "./canvas/CanvasHeader";
import type { ToolGesture } from "./canvas/CanvasHeader";
import SelectionOverlay from "./canvas/SelectionOverlay";
import SelectionActions from "./canvas/SelectionActions";
import PaletteRow from "./canvas/PaletteRow";
import ToolRow from "./canvas/ToolRow";
import PanelModals from "./canvas/PanelModals";
import useColorDrag from "./canvas/useColorDrag";

interface Props {
  page: Page;
  library: Library;
  onChange: (p: Page) => void;
  onLibraryChange: (fn: (l: Library) => Library) => void;
  onClose: () => void;
  onSettings: () => void;
  onNote: () => void;
  onExport: () => void;
  onNavigate: (delta: number) => void;
  onNewPage: () => void;
  notify: (s: string) => void;
}
export type Selection = Photo & { kind: "ink" | "photo"; before?: Page };
const asPhoto = (s: Photo): Photo => ({
  id: s.id,
  src: s.src,
  x: s.x,
  y: s.y,
  width: s.width,
  height: s.height,
  rotation: s.rotation,
});
const histories = new Map<string, { undo: Page[]; redo: Page[] }>();
export default function DrawingCanvas({
  page,
  library,
  onChange,
  onLibraryChange,
  onClose,
  onSettings,
  onNote,
  onExport,
  onNavigate,
  onNewPage,
  notify,
}: Props) {
  const [preferences] = useState(readCanvasPreferences);
  const stage = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLDivElement>(null),
    base = useRef<HTMLCanvasElement>(null),
    ink = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    file = useRef<HTMLInputElement>(null);
  const engine = useRef<InkEngine | null>(null),
    draft = useRef(page),
    alive = useRef(true),
    renderTicket = useRef(0),
    frame = useRef(0),
    points = useRef<Point[]>([]),
    active = useRef<number | null>(null),
    lastMove = useRef(0),
    strokeStart = useRef<Sample | null>(null),
    penActive = useRef(false),
    brushActive = useRef(false),
    pointerMap = useRef(new Map<number, Point>());
  const [ready, setReady] = useState(false),
    [problem, setProblem] = useState(""),
    [tool, setTool] = useState<Tool>(preferences.tool),
    [sizes, setSizes] = useState<Partial<Record<Tool, BrushSize>>>(
      preferences.sizes,
    ),
    [palette, setPalette] = useState(
      Math.min(preferences.palette, library.palettes.length - 1),
    ),
    [swatch, setSwatch] = useState(preferences.swatch),
    [customColor, setCustomColor] = useState<string | null>(null),
    [colorOpen, setColorOpen] = useState(false),
    [picker, setPicker] = useState(false),
    [trayVisible, setTrayVisible] = useState(preferences.trayVisible),
    [panel, setPanel] = useState<
      null | "templates" | "clips" | "erase" | "collage"
    >(null),
    [sizeOpen, setSizeOpen] = useState(false),
    [fit, setFit] = useState(1),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [selection, setSelection] = useState<Selection | null>(null),
    [historyVersion, setHistoryVersion] = useState(0),
    [cursor, setCursor] = useState<Point | null>(null);
  useEffect(
    () => saveCanvasPreferences({ tool, sizes, palette, swatch, trayVisible }),
    [tool, sizes, palette, swatch, trayVisible],
  );
  const [rewind, setRewind] = useState<{
    x: number;
    y: number;
    frames: Page[];
    index: number;
  } | null>(null);
  const [transcription, setTranscription] = useState<Page | null>(null);
  const rewindRef = useRef(rewind);
  rewindRef.current = rewind;
  const rewindTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerGesture = useRef<number | null>(null),
    pickedColor = useRef<string | null>(null);
  const restoreSequence = useRef(0),
    restoring = useRef(false);
  const lastInk = useRef("#173d4a");
  const toolGesture = useRef<ToolGesture | null>(null);
  const ignoreToolClick = useRef(false);
  const colorDrag = useColorDrag(
    (index, hex) =>
      onLibraryChange((l) => ({
        ...l,
        palettes: l.palettes.map((p, i) =>
          i === palette ? p.map((c, n) => (n === index ? hex : c)) : p,
        ),
      })),
    (hex) => commit({ ...draft.current, background: hex }),
  );
  const photoCut = useRef<string | null>(null),
    traySwipe = useRef(0);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const history = histories.get(page.id) || { undo: [], redo: [] };
  histories.set(page.id, history);
  const color =
      customColor || library.palettes[palette]?.[swatch] || lastInk.current,
    size = sizes[tool] || "md";
  lastInk.current = color;
  const pinch = useRef<{
    distance: number;
    center: Point;
    zoom: number;
    pan: Point;
    initial: Point[];
    moved: boolean;
  } | null>(null);
  const mixedColor = useRef("#e9d6a5");

  async function drawBase(p: Page) {
    const t = ++renderTicket.current;
    try {
      const selected = selectionRef.current;
      const c = await composePage(
        {
          ...p,
          ink: "",
          photos: p.photos.filter(
            (im) => !(selected?.kind === "photo" && im.id === selected.id),
          ),
        },
        true,
        library.templates,
      );
      if (t === renderTicket.current && base.current) {
        const ctx = base.current.getContext("2d")!;
        ctx.clearRect(0, 0, p.width, p.height);
        ctx.drawImage(c, 0, 0);
      }
    } catch (e) {
      if (alive.current)
        setProblem(
          e instanceof Error ? e.message : "Could not render this page.",
        );
    }
  }
  const paint = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const e = engine.current,
        c = ink.current;
      if (e && c) {
        e.present();
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(e.canvas, 0, 0);
      }
    });
  };
  useEffect(() => {
    alive.current = true;
    let e: InkEngine;
    try {
      e = new InkEngine(page.width, page.height);
      engine.current = e;
    } catch (err) {
      setProblem(
        err instanceof Error ? err.message : "Drawing is unavailable.",
      );
      return;
    }
    void Promise.all([e.prepare(), e.load(page.ink), drawBase(page)])
      .then(() => {
        if (alive.current && engine.current === e) {
          setReady(true);
          paint();
        }
      })
      .catch((err) => {
        if (alive.current) setProblem(String(err.message));
      });
    return () => {
      alive.current = false;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      e.destroy();
      if (engine.current === e) engine.current = null;
    };
  }, [page.id]);
  useEffect(() => {
    if (page !== draft.current) {
      const reload = page.ink !== draft.current.ink;
      draft.current = page;
      void drawBase(page);
      if (reload && engine.current)
        void engine.current.load(page.ink).then(paint);
    }
  }, [page]);
  useEffect(() => {
    void drawBase(draft.current);
  }, [selection?.id]);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const stop = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setFit(
        Math.min(
          (entry.contentRect.width - 36) / page.width,
          (entry.contentRect.height - 32) / page.height,
        ),
      ),
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [page.width, page.height]);
  function commit(p: Page, before = draft.current) {
    history.undo.push(structuredClone(before));
    if (history.undo.length > 35) history.undo.shift();
    history.redo = [];
    draft.current = { ...p, thumbnail: "" };
    onChange(draft.current);
    setHistoryVersion((v) => v + 1);
    void drawBase(draft.current);
  }
  async function restore(p: Page) {
    const revision = ++restoreSequence.current;
    restoring.current = true;
    draft.current = p;
    selectionRef.current = null;
    setSelection(null);
    onChange(p);
    await engine.current?.load(p.ink);
    if (revision !== restoreSequence.current || !alive.current) return;
    restoring.current = false;
    paint();
    void drawBase(p);
    setHistoryVersion((v) => v + 1);
  }
  function undo() {
    if (selectionRef.current) {
      void restore(selectionRef.current.before || draft.current);
      return;
    }
    const p = history.undo.pop();
    if (p) {
      history.redo.push(structuredClone(draft.current));
      void restore(p);
    }
  }
  function redo() {
    const p = history.redo.pop();
    if (p) {
      history.undo.push(structuredClone(draft.current));
      void restore(p);
    }
  }
  function openRewind(center?: Point) {
    if (active.current !== null || selectionRef.current) return;
    const frames = historyFrames(history, draft.current);
    if (frames.length < 2) return;
    const r = stage.current?.getBoundingClientRect();
    setRewind({
      x: Math.max(
        110,
        Math.min(
          window.innerWidth - 110,
          center?.x ?? (r ? r.left + r.width / 2 : window.innerWidth / 2),
        ),
      ),
      y: Math.max(
        130,
        Math.min(
          window.innerHeight - 190,
          center?.y ?? (r ? r.top + r.height / 2 : window.innerHeight / 2),
        ),
      ),
      frames,
      index: history.undo.length,
    });
  }
  function seekRewind(index: number) {
    const r = rewindRef.current;
    if (!r) return;
    const at = Math.max(0, Math.min(r.frames.length - 1, index));
    if (at === r.index) return;
    rewindRef.current = { ...r, index: at };
    setRewind(rewindRef.current);
    void restore(seekHistory(history, r.frames, at));
  }
  function twoFingerTap(center: Point) {
    if (rewindTap.current) {
      clearTimeout(rewindTap.current);
      rewindTap.current = null;
      undo();
    } else
      rewindTap.current = setTimeout(() => {
        rewindTap.current = null;
        openRewind(center);
      }, 300);
  }
  useEffect(
    () => () => {
      if (rewindTap.current) clearTimeout(rewindTap.current);
      if (toolGesture.current?.timer) clearTimeout(toolGesture.current.timer);
    },
    [],
  );
  function addPalette() {
    setPalette(library.palettes.length);
    setSwatch(0);
    setCustomColor(color);
    setColorOpen(false);
    onLibraryChange((l) => ({
      ...l,
      palettes: [...l.palettes, Array<string>(7).fill("")],
    }));
  }
  function changePalette(direction: number) {
    const next = palette + direction;
    if (next >= library.palettes.length) {
      addPalette();
      return;
    }
    setPalette(Math.max(0, next));
    setCustomColor(color);
    setColorOpen(false);
  }
  function swatchClick(i: number, c: string) {
    if (i === swatch && !customColor) setColorOpen((v) => !v);
    else {
      setSwatch(i);
      if (c) setCustomColor(null);
      setColorOpen(!c);
    }
  }
  function deletePalette() {
    onLibraryChange((l) => ({
      ...l,
      palettes: l.palettes.filter((_, i) => i !== palette),
    }));
    setPalette(Math.max(0, Math.min(palette, library.palettes.length - 2)));
    setCustomColor(color);
    setColorOpen(false);
  }
  function sizeGestureStart(e: ReactPointerEvent<HTMLButtonElement>, id: Tool) {
    if (e.button !== 0) return;
    ignoreToolClick.current = false;
    const timer =
      id === "erase"
        ? window.setTimeout(() => {
            if (toolGesture.current) {
              toolGesture.current.changed = true;
              ignoreToolClick.current = true;
              setTool(id);
              setPanel("erase");
              setSizeOpen(false);
            }
          }, 500)
        : null;
    toolGesture.current = {
      id,
      y: e.clientY,
      size: sizes[id] || "md",
      changed: false,
      timer,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function sizeGestureMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const g = toolGesture.current;
    if (!g) return;
    if (Math.abs(e.clientY - g.y) < 18) return;
    if (g.timer) clearTimeout(g.timer);
    g.changed = true;
    ignoreToolClick.current = true;
    const all: BrushSize[] = ["sm", "md", "lg"];
    const next =
      all[
        Math.max(
          0,
          Math.min(2, all.indexOf(g.size) + Math.round((g.y - e.clientY) / 36)),
        )
      ];
    setTool(g.id);
    setSizes((s) => ({ ...s, [g.id]: next }));
    setSizeOpen(true);
    setPanel(null);
  }
  function sizeGestureEnd() {
    if (toolGesture.current?.timer) clearTimeout(toolGesture.current.timer);
    toolGesture.current = null;
  }
  const clearOverlay = () =>
    overlay.current?.getContext("2d")?.clearRect(0, 0, page.width, page.height);
  const position = (e: { clientX: number; clientY: number }): Point => {
    const r = surface.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * page.width) / r.width,
      y: ((e.clientY - r.top) * page.height) / r.height,
    };
  };
  const sample = (e: PointerEvent): Sample => ({
    ...position(e),
    pressure: e.pointerType === "pen" ? e.pressure : 0.5,
    tilt: Math.max(Math.abs(e.tiltX || 0), Math.abs(e.tiltY || 0)),
    time: e.timeStamp,
  });
  async function applySelection(s = selectionRef.current) {
    if (!s) return;
    setSelection(null);
    selectionRef.current = null;
    if (s.kind === "photo") {
      const photos = draft.current.photos.map((p) =>
        p.id === s.id ? asPhoto(s) : p,
      );
      commit({ ...draft.current, photos }, s.before || draft.current);
      return;
    }
    const e = engine.current!;
    e.present();
    const c = canvas(page.width, page.height),
      ctx = c.getContext("2d")!;
    ctx.drawImage(e.canvas, 0, 0);
    ctx.save();
    ctx.translate(s.x + s.width / 2, s.y + s.height / 2);
    ctx.rotate(s.rotation);
    ctx.drawImage(
      await loadImage(s.src),
      -s.width / 2,
      -s.height / 2,
      s.width,
      s.height,
    );
    ctx.restore();
    e.loadCanvas(c);
    paint();
    commit({ ...draft.current, ink: c.toDataURL() }, s.before || draft.current);
  }
  function cancelSelection() {
    const s = selectionRef.current;
    if (s?.before) void restore(s.before);
    else setSelection(null);
  }
  async function cutSelection(path: Point[]) {
    const b = bounds(path),
      x = Math.max(0, Math.floor(b.x)),
      y = Math.max(0, Math.floor(b.y)),
      w = Math.min(page.width - x, Math.ceil(b.width)),
      h = Math.min(page.height - y, Math.ceil(b.height));
    if (w < 3 || h < 3) return;
    const photo = draft.current.photos.find((p) => p.id === photoCut.current);
    if (photo) {
      const c = canvas(w, h),
        ctx = c.getContext("2d")!;
      ctx.translate(-x, -y);
      polygon(ctx, path);
      ctx.clip();
      ctx.translate(photo.x + photo.width / 2, photo.y + photo.height / 2);
      ctx.rotate(photo.rotation);
      ctx.drawImage(
        await loadImage(photo.src),
        -photo.width / 2,
        -photo.height / 2,
        photo.width,
        photo.height,
      );
      const updated = {
        ...photo,
        src: c.toDataURL(),
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
      };
      commit({
        ...draft.current,
        photos: draft.current.photos.map((p) =>
          p.id === photo.id ? updated : p,
        ),
      });
      photoCut.current = null;
      setTool("collage");
      setSelection({
        ...updated,
        kind: "photo",
        before: structuredClone(draft.current),
      });
      return;
    }
    const e = engine.current!;
    e.present();
    const c = canvas(page.width, page.height),
      ctx = c.getContext("2d")!;
    ctx.save();
    polygon(ctx, path);
    ctx.clip();
    ctx.drawImage(e.canvas, 0, 0);
    ctx.restore();
    const cropped = canvas(w, h);
    cropped.getContext("2d")!.drawImage(c, x, y, w, h, 0, 0, w, h);
    const before = structuredClone(draft.current);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(e.canvas, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    polygon(ctx, path);
    ctx.fill();
    e.loadCanvas(c);
    draft.current = { ...draft.current, ink: c.toDataURL() };
    paint();
    setSelection({
      id: uid(),
      src: cropped.toDataURL(),
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      kind: "ink",
      before,
    });
  }
  async function fillPath(path: Point[]) {
    const c = canvas(page.width, page.height),
      ctx = c.getContext("2d")!;
    if (draft.current.fill)
      ctx.drawImage(
        await loadImage(draft.current.fill),
        0,
        0,
        c.width,
        c.height,
      );
    ctx.fillStyle = color;
    if (
      path.length > 3 &&
      Math.hypot(bounds(path).width, bounds(path).height) > 5
    ) {
      polygon(ctx, path);
      ctx.fill();
    } else {
      const combined = await composePage(
          draft.current,
          true,
          library.templates,
        ),
        data = combined.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      const mask = canvas(c.width, c.height),
        mctx = mask.getContext("2d")!;
      mctx.putImageData(
        new ImageData(
          new Uint8ClampedArray(
            floodMask(
              data.data,
              c.width,
              c.height,
              Math.floor(path[0].x),
              Math.floor(path[0].y),
            ),
          ),
          c.width,
          c.height,
        ),
        0,
        0,
      );
      mctx.globalCompositeOperation = "source-in";
      mctx.fillStyle = color;
      mctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(mask, 0, 0);
    }
    commit({ ...draft.current, fill: c.toDataURL() });
  }
  function diagram(path: Point[], arrow: boolean) {
    const c = canvas(page.width, page.height),
      ctx = c.getContext("2d")!;
    engine.current!.present();
    ctx.drawImage(engine.current!.canvas, 0, 0);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = { sm: 2, md: 4, lg: 7 }[size];
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const b = bounds(path),
      kind = recognize(path);
    ctx.beginPath();
    if (kind === "line") {
      ctx.moveTo(path[0].x, path[0].y);
      const end = path.at(-1)!;
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      if (arrow) {
        const a = Math.atan2(end.y - path[0].y, end.x - path[0].x);
        ctx.beginPath();
        ctx.moveTo(
          end.x - Math.cos(a - 0.55) * 18,
          end.y - Math.sin(a - 0.55) * 18,
        );
        ctx.lineTo(end.x, end.y);
        ctx.lineTo(
          end.x - Math.cos(a + 0.55) * 18,
          end.y - Math.sin(a + 0.55) * 18,
        );
        ctx.stroke();
      }
    } else if (kind === "ellipse") {
      ctx.ellipse(
        b.x + b.width / 2,
        b.y + b.height / 2,
        Math.max(1, b.width / 2),
        Math.max(1, b.height / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (kind === "triangle") {
      polygon(ctx, [
        { x: b.x + b.width / 2, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
        { x: b.x, y: b.y + b.height },
      ]);
      ctx.stroke();
    } else {
      ctx.rect(b.x, b.y, b.width, b.height);
      ctx.stroke();
    }
    engine.current!.loadCanvas(c);
    paint();
    commit({ ...draft.current, ink: c.toDataURL() });
  }
  function pointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!ready || restoring.current || rewindRef.current || e.button !== 0)
      return;
    if (e.pointerType === "touch" && penActive.current) return;
    if (e.pointerType === "pen" && !penActive.current) {
      if (brushActive.current) {
        engine.current?.cancel();
        brushActive.current = false;
        paint();
      }
      active.current = null;
      clearOverlay();
      pointerMap.current.clear();
      pinch.current = null;
    }
    const p = position(e);
    pointerMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointerMap.current.size === 2 && !penActive.current) {
      if (active.current !== null) {
        if (brushActive.current) {
          engine.current?.cancel();
          brushActive.current = false;
          paint();
        }
        clearOverlay();
        active.current = null;
      }
      const ps = [...pointerMap.current.values()];
      pinch.current = {
        distance: Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y),
        center: { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 },
        zoom,
        pan,
        initial: ps,
        moved: false,
      };
      return;
    }
    if (e.pointerType === "touch" && !library.settings.fingerDraw && !picker)
      return;
    if (active.current !== null) {
      if (e.pointerType !== "pen") return;
      if (brushActive.current) {
        engine.current?.cancel();
        brushActive.current = false;
        paint();
      }
    }
    if (selectionRef.current) {
      void applySelection();
      return;
    }
    if (picker) {
      if (pickedColor.current) {
        saveColor(pickedColor.current);
        setPicker(false);
        pickedColor.current = null;
        setColorOpen(true);
      } else {
        pickerGesture.current = e.pointerId;
        sampleColor(p);
      }
      return;
    }
    if (tool === "collage") {
      const hit = [...draft.current.photos].reverse().find((im) => {
        const dx = p.x - im.x - im.width / 2,
          dy = p.y - im.y - im.height / 2,
          c = Math.cos(-im.rotation),
          s = Math.sin(-im.rotation);
        return (
          Math.abs(dx * c - dy * s) <= im.width / 2 &&
          Math.abs(dx * s + dy * c) <= im.height / 2
        );
      });
      if (hit)
        setSelection({
          ...hit,
          kind: "photo",
          before: structuredClone(draft.current),
        });
      else setPanel("collage");
      return;
    }
    if (tool === "canvas-roll") {
      setPanel("templates");
      return;
    }
    active.current = e.pointerId;
    penActive.current = e.pointerType === "pen";
    strokeStart.current = sample(e.nativeEvent);
    lastMove.current = e.timeStamp;
    points.current = [p];
    if (!["cut", "fill", "diagram"].includes(tool)) {
      brushActive.current = true;
      engine.current!.begin(tool, size, color, sample(e.nativeEvent));
      paint();
    }
  }
  function sampleColor(p: Point) {
    const c = canvas(page.width, page.height),
      ctx = c.getContext("2d")!;
    ctx.drawImage(base.current!, 0, 0);
    ctx.drawImage(ink.current!, 0, 0);
    const rgb = ctx.getImageData(
      Math.max(0, Math.min(page.width - 1, Math.floor(p.x))),
      Math.max(0, Math.min(page.height - 1, Math.floor(p.y))),
      1,
      1,
    ).data;
    const hex =
      "#" +
      Array.from(rgb.slice(0, 3), (n) => n.toString(16).padStart(2, "0")).join(
        "",
      );
    pickedColor.current = hex;
    setCustomColor(hex);
    setCursor(p);
  }
  function pointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (picker) {
      setCursor(position(e));
      if (pickerGesture.current === e.pointerId) {
        sampleColor(position(e));
        return;
      }
    }
    if (pointerMap.current.has(e.pointerId))
      pointerMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointerMap.current.size >= 2) {
      const ps = [...pointerMap.current.values()],
        g = pinch.current;
      const d = Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y);
      const center = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      if (
        Math.abs(d - g.distance) > 8 ||
        Math.hypot(center.x - g.center.x, center.y - g.center.y) > 8
      )
        g.moved = true;
      setZoom(
        Math.max(0.55, Math.min(5, (g.zoom * d) / Math.max(1, g.distance))),
      );
      setPan({
        x: g.pan.x + center.x - g.center.x,
        y: g.pan.y + center.y - g.center.y,
      });
      return;
    }
    if (active.current !== e.pointerId) return;
    lastMove.current = e.timeStamp;
    const events = e.nativeEvent.getCoalescedEvents?.();
    for (const ev of events?.length ? events : [e.nativeEvent]) {
      const p = position(ev);
      if (["cut", "fill", "diagram"].includes(tool)) {
        points.current.push(p);
        const ctx = overlay.current!.getContext("2d")!;
        ctx.clearRect(0, 0, page.width, page.height);
        ctx.strokeStyle = tool === "cut" ? "#477b8c" : color;
        ctx.lineWidth = tool === "cut" ? 2 / fit : 2;
        ctx.setLineDash(tool === "cut" ? [7 / fit, 5 / fit] : []);
        polygon(ctx, points.current, tool === "fill");
        if (tool === "fill") {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = color;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.stroke();
      } else engine.current!.append(sample(ev));
    }
    paint();
  }
  function pointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    pointerMap.current.delete(e.pointerId);
    if (pickerGesture.current === e.pointerId) {
      pickerGesture.current = null;
      notify("Tap to keep this color");
      return;
    }
    if (pinch.current) {
      if (pointerMap.current.size === 0) {
        const g = pinch.current;
        pinch.current = null;
        if (!g.moved) twoFingerTap(g.center);
        else if (zoom < 0.75) {
          onClose();
        } else if (
          g.zoom === 1 &&
          Math.abs(pan.x - g.pan.x) > 120 &&
          Math.abs(zoom - 1) < 0.15
        ) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
          onNewPage();
        } else if (zoom < 1) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      }
      return;
    }
    if (active.current !== e.pointerId) return;
    active.current = null;
    penActive.current = false;
    clearOverlay();
    const start = strokeStart.current,
      end = position(e);
    if (
      e.pointerType === "touch" &&
      start &&
      ((start.x < 22 && end.x - start.x > 70) ||
        (start.x > page.width - 22 && start.x - end.x > 70))
    ) {
      if (brushActive.current) {
        engine.current!.cancel();
        brushActive.current = false;
        paint();
      }
      onNavigate(start.x < 22 ? -1 : 1);
      return;
    }
    if (tool === "cut") {
      void cutSelection(points.current);
    } else if (tool === "fill") {
      void fillPath(points.current).catch((err) => setProblem(err.message));
    } else if (tool === "diagram") {
      if (points.current.length > 1)
        diagram(points.current, e.timeStamp - lastMove.current > 450);
    } else {
      engine.current!.append(sample(e.nativeEvent));
      commit({ ...draft.current, ink: engine.current!.end() });
      brushActive.current = false;
      paint();
    }
  }
  function pointerCancel(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (pickerGesture.current === e.pointerId) {
      pickerGesture.current = null;
      pickedColor.current = null;
    }
    pointerMap.current.delete(e.pointerId);
    if (active.current === e.pointerId) {
      active.current = null;
      penActive.current = false;
      if (brushActive.current) {
        engine.current?.cancel();
        brushActive.current = false;
        paint();
      }
      clearOverlay();
    }
    if (!pointerMap.current.size) pinch.current = null;
  }
  function chooseTool(id: Tool) {
    if (active.current !== null) return;
    if (id !== "canvas-roll" && id !== "collage") setPanel(null);
    photoCut.current = null;
    if (selectionRef.current) void applySelection();
    if (tool === id && tools.find((t) => t.id === id)?.sized)
      setSizeOpen((v) => !v);
    else {
      setTool(id);
      setSizeOpen(false);
    }
    setColorOpen(false);
    if (id === "canvas-roll") setPanel("templates");
    if (id === "collage") setPanel("collage");
  }
  async function addPhotos(files: FileList | File[]) {
    try {
      const before = draft.current,
        photos = [...before.photos];
      for (const f of Array.from(files)) {
        const image = await fileImage(f);
        const s = Math.min(
          (page.width * 0.55) / image.width,
          (page.height * 0.6) / image.height,
          1,
        );
        photos.push({
          id: uid(),
          src: image.src,
          width: image.width * s,
          height: image.height * s,
          x: (page.width - image.width * s) / 2,
          y: (page.height - image.height * s) / 2,
          rotation: 0,
        });
      }
      commit({ ...before, photos });
      setTool("collage");
      setPanel(null);
      const p = photos.at(-1);
      if (p)
        setSelection({ ...p, kind: "photo", before: { ...before, photos } });
    } catch (err) {
      setProblem(
        err instanceof Error ? err.message : "Could not import this image.",
      );
    }
  }
  function deleteSelection() {
    const s = selectionRef.current;
    if (!s) return;
    selectionRef.current = null;
    if (s.kind === "photo")
      commit(
        {
          ...draft.current,
          photos: draft.current.photos.filter((p) => p.id !== s.id),
        },
        s.before || draft.current,
      );
    else commit(draft.current, s.before || draft.current);
    setSelection(null);
  }
  async function duplicateSelection() {
    const s = selectionRef.current;
    if (!s) return;
    if (s.kind === "photo") {
      const p = { ...asPhoto(s), id: uid(), x: s.x + 30, y: s.y + 30 };
      commit(
        {
          ...draft.current,
          photos: [
            ...draft.current.photos.map((p) =>
              p.id === s.id ? asPhoto(s) : p,
            ),
            p,
          ],
        },
        s.before || draft.current,
      );
      setSelection({ ...p, kind: "photo", before: draft.current });
    } else {
      await applySelection(s);
      setSelection({
        ...s,
        id: uid(),
        x: s.x + 30,
        y: s.y + 30,
        before: structuredClone(draft.current),
      });
    }
  }
  function clipSelection() {
    const s = selectionRef.current;
    if (!s) return;
    const c: Clip = { id: uid(), src: s.src, width: s.width, height: s.height };
    onLibraryChange((l) => ({ ...l, clips: [...l.clips, c] }));
    notify("Saved to Canvas Clips");
  }
  function insertClip(c: Clip) {
    setSelection({
      id: uid(),
      src: c.src,
      width: c.width,
      height: c.height,
      x: (page.width - c.width) / 2,
      y: (page.height - c.height) / 2,
      rotation: 0,
      kind: "ink",
      before: structuredClone(draft.current),
    });
    setPanel(null);
    setTool("cut");
  }
  function cutOutPhoto() {
    if (!selection) return;
    const id = selection.id;
    void applySelection().then(() => {
      photoCut.current = id;
      setTool("cut");
      notify("Draw around the part of the image you want to keep");
    });
  }
  function bringToFront() {
    if (!selection) return;
    commit(
      {
        ...draft.current,
        photos: [
          ...draft.current.photos.filter((p) => p.id !== selection.id),
          asPhoto(selection),
        ],
      },
      selection.before || draft.current,
    );
    setSelection({ ...selection, before: draft.current });
  }
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (
        (e.target as HTMLElement).closest("input,textarea,[contenteditable]") ||
        document.querySelector(".modal-backdrop")
      )
        return;
      const files = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        e.preventDefault();
        void applySelection().then(() => addPhotos(files));
      }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (rewindRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setRewind(null);
        }
        return;
      }
      if (
        (e.target as HTMLElement).closest("input,textarea,[contenteditable]") ||
        document.querySelector(".modal-backdrop")
      )
        return;
      if (e.key === "Escape" && panel) {
        e.preventDefault();
        e.stopPropagation();
        setPanel(null);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectionRef.current
      ) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === "Enter" && selectionRef.current) {
        e.preventDefault();
        void applySelection();
        return;
      }
      if (e.key === "Escape" && selectionRef.current) {
        e.preventDefault();
        e.stopPropagation();
        cancelSelection();
        return;
      }
      if (e.key.toLowerCase() === "t" && !mod) {
        e.preventDefault();
        setTrayVisible((v) => !v);
      }
      if (e.key === "0" && mod) {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      if (!mod) {
        const t = tools.find(
          (t) => t.key?.toLowerCase() === e.key.toLowerCase(),
        );
        if (t) chooseTool(t.id);
        if (e.key === "[" || e.key === "]") {
          const a: BrushSize[] = ["sm", "md", "lg"];
          setSizes((s) => ({
            ...s,
            [tool]:
              a[
                Math.max(
                  0,
                  Math.min(2, a.indexOf(size) + (e.key === "]" ? 1 : -1)),
                )
              ],
          }));
        }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });
  const saveColor = (hex: string) => {
    setCustomColor(null);
    onLibraryChange((l) => ({
      ...l,
      palettes: l.palettes.map((p, i) =>
        i === palette ? p.map((c, n) => (n === swatch ? hex : c)) : p,
      ),
    }));
  };
  const currentTool = tools.find((t) => t.id === tool)!;
  void historyVersion;
  return (
    <section
      className={"drawing-workspace " + (picker ? "picking" : "")}
      aria-label="Drawing canvas"
      data-ready={ready}
    >
      {rewind && (
        <RewindDial
          {...rewind}
          total={rewind.frames.length}
          onSeek={seekRewind}
          onClose={() => setRewind(null)}
        />
      )}
      {colorDrag.dragColor && (
        <div
          className="drag-color"
          style={{
            left: colorDrag.dragColor.x,
            top: colorDrag.dragColor.y,
            background: colorDrag.dragColor.hex,
          }}
        />
      )}
      {transcription && (
        <TranscribeDialog
          page={transcription}
          templates={library.templates}
          onClose={() => setTranscription(null)}
          onSave={(text) => {
            commit({
              ...draft.current,
              note: [draft.current.note, text].filter(Boolean).join("\n\n"),
            });
            setTranscription(null);
            notify("Text saved to your note");
          }}
        />
      )}
      <CanvasHeader
        cleanCanvas={library.settings.cleanCanvas}
        canUndo={!!history.undo.length || !!selection}
        canRedo={!!history.redo.length}
        toolGesture={toolGesture}
        ignoreToolClick={ignoreToolClick}
        onSizeGestureEnd={sizeGestureEnd}
        onOpenRewind={() => openRewind()}
        onUndo={undo}
        onRedo={redo}
        onClose={() => void applySelection().then(onClose)}
        onTranscribe={() =>
          void applySelection().then(() =>
            setTranscription(structuredClone(draft.current)),
          )
        }
        onNote={onNote}
        onExport={() => void applySelection().then(onExport)}
        onSettings={onSettings}
        onShowControls={() =>
          onLibraryChange((l) => ({
            ...l,
            settings: { ...l.settings, cleanCanvas: false },
          }))
        }
      />
      <div
        className="canvas-stage"
        ref={stage}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            setZoom((z) => Math.max(1, Math.min(5, z - e.deltaY * 0.01)));
          } else if (zoom > 1)
            setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const c = e.dataTransfer.getData("application/x-paper-color");
          if (/^#[0-9a-f]{6}$/i.test(c))
            commit({ ...draft.current, background: c });
          else if (e.dataTransfer.files.length)
            void addPhotos(e.dataTransfer.files);
        }}
      >
        <div
          ref={surface}
          className="paper-surface"
          style={{
            width: page.width,
            height: page.height,
            transform:
              "translate(-50%, -50%) translate(" +
              pan.x +
              "px," +
              pan.y +
              "px) scale(" +
              fit * zoom +
              ")",
            background: page.background,
          }}
        >
          <canvas ref={base} width={page.width} height={page.height} />
          <canvas ref={ink} width={page.width} height={page.height} />
          {library.settings.showGrid && zoom > 1 && (
            <div className="zoom-grid" />
          )}
          <canvas
            ref={overlay}
            width={page.width}
            height={page.height}
            className="input-canvas"
            aria-label="Draw on this page"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerCancel}
            onPointerLeave={() => setCursor(null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          {selection && (
            <SelectionOverlay
              selection={selection}
              fit={fit}
              zoom={zoom}
              onUpdate={setSelection}
            />
          )}
          {picker && cursor && (
            <div
              className="eyedropper-target"
              style={{ left: cursor.x, top: cursor.y }}
            />
          )}
        </div>
      </div>
      {zoom > 1 && (
        <button
          className="zoom-reset"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Maximize size={14} />
          {Math.round(zoom * 100)}%
        </button>
      )}
      {!ready && !problem && (
        <div className="canvas-loading">
          <div className="loading-orbit" />
        </div>
      )}
      {selection && (
        <SelectionActions
          kind={selection.kind}
          onApply={() => void applySelection()}
          onDuplicate={() => void duplicateSelection()}
          onClip={clipSelection}
          onRotate={() =>
            setSelection((s) =>
              s ? { ...s, rotation: s.rotation + Math.PI / 12 } : s,
            )
          }
          onCutOut={cutOutPhoto}
          onBringToFront={bringToFront}
          onDelete={deleteSelection}
          onCancel={cancelSelection}
        />
      )}
      {!library.settings.cleanCanvas && (
        <div className="canvas-page-navigation">
          <IconButton
            label="Previous canvas page"
            onClick={() => {
              void applySelection().then(() => onNavigate(-1));
            }}
          >
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton
            label="New canvas page"
            onClick={() => {
              void applySelection().then(onNewPage);
            }}
          >
            <Plus size={19} />
          </IconButton>
          <IconButton
            label="Next canvas page"
            onClick={() => {
              void applySelection().then(() => onNavigate(1));
            }}
          >
            <ChevronRight size={18} />
          </IconButton>
        </div>
      )}
      <div
        className={
          "tool-tray " +
          (trayVisible ? "" : "tray-hidden") +
          (panel === "templates" ? " tray-expanded" : "")
        }
      >
        {panel === "templates" && (
          <TemplateStrip
            library={library}
            selected={draft.current.template}
            onClose={() => setPanel(null)}
            onSelect={(n) => {
              commit({ ...draft.current, template: n });
            }}
            onCapture={() => {
              void composePage(draft.current, true, library.templates).then(
                (c) => {
                  const id = uid();
                  onLibraryChange((l) => ({
                    ...l,
                    templates: [...l.templates, { id, src: c.toDataURL() }],
                  }));
                  notify("Template captured");
                },
              );
            }}
            onDefault={() => {
              onLibraryChange((l) => ({
                ...l,
                journals: l.journals.map((j, i) =>
                  i === l.selected
                    ? { ...j, template: draft.current.template }
                    : j,
                ),
              }));
              notify("Default template set for this journal");
            }}
            onDelete={(id) => {
              const src = library.templates.find((t) => t.id === id)?.src;
              if (!src) return;
              const detach = (p: Page) =>
                p.template === id ? { ...p, template: src } : p;
              history.undo = history.undo.map(detach);
              history.redo = history.redo.map(detach);
              draft.current = detach(draft.current);
              onLibraryChange((l) => ({
                ...l,
                templates: l.templates.filter((t) => t.id !== id),
                pages: Object.fromEntries(
                  Object.entries(l.pages).map(([key, p]) => [key, detach(p)]),
                ),
                journals: l.journals.map((j) =>
                  j.template === id ? { ...j, template: src } : j,
                ),
              }));
            }}
          />
        )}
        {colorOpen && (
          <ColorPanel
            key={palette + "-" + swatch}
            color={color}
            onChange={saveColor}
            onClose={() => setColorOpen(false)}
            onPicker={() => {
              pickedColor.current = null;
              pickerGesture.current = null;
              setPicker(true);
              setColorOpen(false);
              notify("Drag to pick a color, then tap to keep it");
            }}
            onBackground={() => {
              commit({ ...draft.current, background: color });
              setColorOpen(false);
            }}
          />
        )}
        {sizeOpen && currentTool.sized && (
          <div className="size-picker" role="group" aria-label="Brush size">
            {(["sm", "md", "lg"] as BrushSize[]).map((s, i) => (
              <button
                key={s}
                aria-label={["Small brush", "Medium brush", "Large brush"][i]}
                className={size === s ? "selected" : ""}
                onClick={() => {
                  setSizes((v) => ({ ...v, [tool]: s }));
                  setSizeOpen(false);
                }}
              >
                <span style={{ width: 8 + i * 6, height: 8 + i * 6 }} />
              </button>
            ))}
          </div>
        )}
        <PaletteRow
          palettes={library.palettes}
          palette={palette}
          swatch={swatch}
          customColor={customColor}
          colorDrag={colorDrag}
          onAddPalette={addPalette}
          onChangePalette={changePalette}
          onSwatchClick={swatchClick}
          onDeletePalette={deletePalette}
          onOpenClips={() => setPanel("clips")}
          onHideTray={() => setTrayVisible(false)}
        />
        <ToolRow
          tool={tool}
          sizes={sizes}
          color={color}
          mixedColor={mixedColor}
          colorDrag={colorDrag}
          sizeGesture={{
            start: sizeGestureStart,
            move: sizeGestureMove,
            end: sizeGestureEnd,
            ignoreClick: ignoreToolClick,
          }}
          onChooseTool={chooseTool}
          onErasePanel={() => setPanel("erase")}
          onMixColor={setCustomColor}
          onToggleColorOpen={() => setColorOpen((v) => !v)}
        />
        <div
          className="tray-grip"
          onPointerDown={(e) => {
            traySwipe.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (e.clientY - traySwipe.current > 18) setTrayVisible(false);
          }}
        />
      </div>
      {!trayVisible && (
        <button
          className="show-tray"
          aria-label="Show tool tray"
          onPointerDown={(e) => {
            traySwipe.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.buttons && traySwipe.current - e.clientY > 18)
              setTrayVisible(true);
          }}
          onClick={() => setTrayVisible(true)}
        >
          <Icon name="canvas-shell-show-tool-tray" />
        </button>
      )}
      {(panel === "clips" || panel === "collage" || panel === "erase") && (
        <PanelModals
          panel={panel}
          clips={library.clips}
          onUseClip={insertClip}
          onDeleteClip={(id) =>
            onLibraryChange((l) => ({
              ...l,
              clips: l.clips.filter((x) => x.id !== id),
            }))
          }
          onChooseCut={() => {
            setTool("cut");
            setPanel(null);
          }}
          onAddPhotos={() => file.current?.click()}
          onOpenClips={() => setPanel("clips")}
          eraseActions={[
            {
              label: "Clear ink",
              action: () => {
                engine.current!.clear();
                paint();
                commit({ ...draft.current, ink: "" });
              },
            },
            {
              label: "Clear fills",
              action: () => commit({ ...draft.current, fill: "" }),
            },
            {
              label: "Clear images",
              action: () => commit({ ...draft.current, photos: [] }),
            },
          ]}
          onClose={() => setPanel(null)}
        />
      )}
      {problem && (
        <div className="error-banner" role="alert">
          <span>{problem}</span>
          <button
            aria-label="Dismiss drawing error"
            onClick={() => setProblem("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void addPhotos(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}
