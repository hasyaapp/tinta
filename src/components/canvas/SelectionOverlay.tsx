import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Selection } from "../DrawingCanvas";

interface SelectionOverlayProps {
  selection: Selection;
  fit: number;
  zoom: number;
  onUpdate: (s: Selection) => void;
}

export default function SelectionOverlay({
  selection,
  fit,
  zoom,
  onUpdate,
}: SelectionOverlayProps) {
  const dragSelection = useRef<{
    x: number;
    y: number;
    s: Selection;
    resize: boolean;
  } | null>(null);
  function selectionDown(e: ReactPointerEvent, resize = false) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragSelection.current = {
      x: e.clientX,
      y: e.clientY,
      s: selection,
      resize,
    };
  }
  function selectionMove(e: ReactPointerEvent) {
    const drag = dragSelection.current;
    if (!drag) return;
    const dx = (e.clientX - drag.x) / (fit * zoom),
      dy = (e.clientY - drag.y) / (fit * zoom);
    const s = drag.s;
    if (drag.resize) {
      const scale = Math.max(0.1, 1 + Math.max(dx / s.width, dy / s.height));
      onUpdate({ ...s, width: s.width * scale, height: s.height * scale });
    } else onUpdate({ ...s, x: s.x + dx, y: s.y + dy });
  }
  return (
    <div
      className="floating-selection"
      style={{
        left: selection.x,
        top: selection.y,
        width: selection.width,
        height: selection.height,
        transform: "rotate(" + selection.rotation + "rad)",
        borderWidth: 1.5 / (fit * zoom),
      }}
      onPointerDown={(e) => selectionDown(e)}
      onPointerMove={selectionMove}
      onPointerUp={() => {
        dragSelection.current = null;
      }}
    >
      <img src={selection.src} draggable={false} alt="Selected artwork" />
      <button
        className="resize-handle"
        style={{ transform: "scale(" + 1 / (fit * zoom) + ")" }}
        aria-label="Resize selection"
        onPointerDown={(e) => selectionDown(e, true)}
        onPointerMove={selectionMove}
        onPointerUp={(e) => {
          e.stopPropagation();
          dragSelection.current = null;
        }}
      />
    </div>
  );
}
