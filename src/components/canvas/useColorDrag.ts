import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

export interface DragColor {
  hex: string;
  x: number;
  y: number;
}

export interface ColorDragApi {
  start: (
    e: ReactPointerEvent<HTMLElement>,
    hex: string,
    delay?: number,
  ) => void;
  move: (e: ReactPointerEvent<HTMLElement>, swatchDrag?: boolean) => boolean;
  end: (e?: ReactPointerEvent<HTMLElement>) => boolean;
  active: () => boolean;
  dragColor: DragColor | null;
  paletteSwipe: RefObject<{ x: number; y: number } | null>;
  ignorePaletteClick: RefObject<boolean>;
}

export default function useColorDrag(
  onSwatchDrop: (index: number, hex: string) => void,
  onCanvasDrop: (hex: string) => void,
): ColorDragApi {
  const colorDrag = useRef<{
    hex: string;
    x: number;
    y: number;
    active: boolean;
    timer: number | null;
  } | null>(null);
  const [dragColor, setDragColor] = useState<DragColor | null>(null);
  const paletteSwipe = useRef<{ x: number; y: number } | null>(null),
    ignorePaletteClick = useRef(false);
  function start(e: ReactPointerEvent<HTMLElement>, hex: string, delay = 400) {
    if (!hex || e.button !== 0) return;
    clearTimeout(colorDrag.current?.timer ?? undefined);
    const g = {
      hex,
      x: e.clientX,
      y: e.clientY,
      active: false,
      timer: null as number | null,
    };
    g.timer = window.setTimeout(() => {
      g.active = true;
      setDragColor({ hex: g.hex, x: g.x, y: g.y });
    }, delay);
    colorDrag.current = g;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<HTMLElement>, swatchDrag = false) {
    const g = colorDrag.current;
    if (!g) return false;
    const dx = e.clientX - g.x,
      dy = e.clientY - g.y;
    if (!g.active && Math.hypot(dx, dy) > 8) {
      clearTimeout(g.timer ?? undefined);
      g.timer = null;
      if (swatchDrag && Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.3)
        g.active = true;
    }
    if (g.active) {
      e.preventDefault();
      paletteSwipe.current = null;
      ignorePaletteClick.current = true;
      setDragColor({ hex: g.hex, x: e.clientX, y: e.clientY });
      return true;
    }
    return false;
  }
  function end(e?: ReactPointerEvent<HTMLElement>) {
    const g = colorDrag.current;
    if (!g) return false;
    clearTimeout(g.timer ?? undefined);
    colorDrag.current = null;
    setDragColor(null);
    if (!g.active) return false;
    if (e) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const slot = target?.closest<HTMLElement>("[data-swatch]");
      if (slot) onSwatchDrop(Number(slot.dataset.swatch), g.hex);
      else if (target?.closest(".canvas-stage")) onCanvasDrop(g.hex);
    }
    return true;
  }
  useEffect(
    () => () => clearTimeout(colorDrag.current?.timer ?? undefined),
    [],
  );
  return {
    start,
    move,
    end,
    active: () => !!colorDrag.current?.active,
    dragColor,
    paletteSwipe,
    ignorePaletteClick,
  };
}
