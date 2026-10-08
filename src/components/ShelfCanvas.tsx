import { useEffect, useRef, useState } from "react";
import type { Journal } from "../lib/model";
import type { ShelfEngine } from "../engine/shelf/ShelfEngine";

/** How long the shelf keeps re-reading the DOM after a selection change, so the
 *  painted books follow the CSS transition instead of jumping at the end. */
const FOLLOW_MS = 700;

/** Renders the closed books on the Home shelf with real geometry and lighting.
 *
 *  Layout stays owned by the DOM: the renderer reads each `.book-position`
 *  transform and paints the book exactly there, so the accessible buttons and
 *  every measured rectangle keep working unchanged. If WebGL2 is unavailable —
 *  or the context is lost — this renders nothing and the CSS book stays visible
 *  as the fallback. */
export default function ShelfCanvas({
  journals,
  layoutKey,
}: {
  journals: Journal[];
  layoutKey: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ShelfEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (unsupported) return;
    const element = canvas.current;
    if (!element) return;
    let stopped = false;

    const onLost = (event: Event) => {
      event.preventDefault();
      engine.current?.dispose();
      engine.current = null;
      setReady(false);
      setUnsupported(true);
    };
    element.addEventListener("webglcontextlost", onLost);

    void (async () => {
      try {
        const { ShelfEngine } = await import("../engine/shelf/ShelfEngine");
        if (stopped) return;
        if (!ShelfEngine.isSupported()) {
          setUnsupported(true);
          return;
        }
        engine.current = new ShelfEngine(element);
      } catch {
        if (!stopped) setUnsupported(true);
        return;
      }
      // Debug affordance: lets tooling compare the painted book against the DOM
      // rectangle it has to sit on.
      (element as unknown as { shelfEngine?: ShelfEngine }).shelfEngine =
        engine.current;
      setReady(true);
    })();

    return () => {
      stopped = true;
      element.removeEventListener("webglcontextlost", onLost);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [unsupported]);

  /** Paint from the current DOM state, and keep following it while the carousel
   *  transition moves the books. */
  useEffect(() => {
    const element = canvas.current;
    if (!ready || !element || !engine.current) return;
    let disposed = false;
    let frame = 0;

    const paint = () => {
      const active = engine.current;
      if (disposed || !active) return;
      const nodes = Array.from(
        element.parentElement?.querySelectorAll<HTMLElement>(
          ".book-position",
        ) ?? [],
      );
      active.setSize(element.clientWidth, element.clientHeight);
      active.sync(
        nodes.slice(0, journals.length).map((node, i) => ({
          element: node,
          cover: journals[i]?.cover ?? "",
          band: journals[i]?.band ?? "#888888",
        })),
      );
    };

    let until = 0;
    const follow = () => {
      if (disposed || performance.now() > until) return;
      paint();
      frame = requestAnimationFrame(follow);
    };
    const onResize = () => {
      cancelAnimationFrame(frame);
      paint();
      until = performance.now() + FOLLOW_MS;
      frame = requestAnimationFrame(follow);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [ready, journals, layoutKey]);

  if (unsupported) return null;
  return (
    <canvas
      ref={canvas}
      className="shelf-canvas"
      aria-hidden="true"
      data-active={ready || undefined}
    />
  );
}
