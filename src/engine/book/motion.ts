// Controller for the shared book-motion WebGL layer. This module is free of
// three.js so the renderer stays out of the main bundle; the engine is loaded
// on demand, exactly like ShelfCanvas loads ShelfEngine. If WebGL2 is missing
// or the context is lost, `ready` turns false and the components fall back to
// the original CSS keyframe animations.

export interface PageTurnRequest {
  /** The `.page-turn-scene` wrapper; provides the box and the CSS perspective. */
  scene: HTMLElement;
  direction: 1 | -1;
  duration: number;
  /** Composited artwork of the outgoing and incoming page; null keeps paper. */
  front: Promise<HTMLCanvasElement | null>;
  back: Promise<HTMLCanvasElement | null>;
  onSettle: (at: 0 | 1) => void;
}

export interface CoverRequest {
  /** The `.cover-flip` wrapper; provides the CSS perspective. */
  wrapper: HTMLElement;
  /** Hidden probes resolving the keyframes' calc() boxes to real rectangles. */
  closedProbe: HTMLElement;
  openProbe: HTMLElement;
  kind: "open" | "close";
  duration: number;
  cover: string;
  band: string;
  page: Promise<HTMLCanvasElement | null> | null;
  onSettle: () => void;
}

export interface MotionHandle {
  /** Retargets a progress-driven animation; 0 rewinds, 1 completes. */
  setTarget(target: 0 | 1): void;
  release(): void;
}

interface MotionEngine {
  playPageTurn(request: PageTurnRequest): MotionHandle;
  playCover(request: CoverRequest): MotionHandle;
  dispose(): void;
}

class BookMotionController {
  private engine: MotionEngine | null = null;
  private failed = false;
  private listeners = new Set<() => void>();

  /** Binds the singleton canvas. One context serves every flip and cover turn. */
  attach(canvas: HTMLCanvasElement): () => void {
    let stopped = false;
    let detachLost: (() => void) | null = null;
    void (async () => {
      if (this.failed || this.engine) return;
      try {
        // Dynamic on purpose: keeps three.js out of the main bundle, same
        // code-splitting boundary ShelfCanvas uses for ShelfEngine.
        const { BookMotionEngine } = await import("./PageTurn");
        if (stopped) return;
        if (!BookMotionEngine.isSupported()) {
          this.fail();
          return;
        }
        const onLost = (event: Event) => {
          event.preventDefault();
          this.fail();
        };
        canvas.addEventListener("webglcontextlost", onLost);
        detachLost = () =>
          canvas.removeEventListener("webglcontextlost", onLost);
        this.engine = new BookMotionEngine(canvas);
        this.notify();
      } catch {
        if (!stopped) this.fail();
      }
    })();
    return () => {
      stopped = true;
      detachLost?.();
      this.engine?.dispose();
      this.engine = null;
      this.notify();
    };
  }

  get ready(): boolean {
    return !!this.engine && !this.failed;
  }

  /** Null when WebGL is unavailable; callers then keep the CSS animation. */
  playPageTurn(request: PageTurnRequest): MotionHandle | null {
    return this.ready ? this.engine!.playPageTurn(request) : null;
  }

  playCover(request: CoverRequest): MotionHandle | null {
    return this.ready ? this.engine!.playCover(request) : null;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private fail() {
    this.failed = true;
    // Disposal settles running animations so pending onSettle callbacks fire
    // and the UI never waits on a dead context.
    this.engine?.dispose();
    this.engine = null;
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}

export const bookMotion = new BookMotionController();
