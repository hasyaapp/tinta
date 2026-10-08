import { useRef } from "react";
import { Icon, IconButton } from "./UI";
import { angleDelta } from "../lib/rewind";
export default function RewindDial({
  x,
  y,
  index,
  total,
  onSeek,
  onClose,
}: {
  x: number;
  y: number;
  index: number;
  total: number;
  onSeek: (i: number) => void;
  onClose: () => void;
}) {
  const gesture = useRef<{ angle: number; offset: number } | null>(null);
  return (
    <div
      className="rewind-layer"
      role="region"
      aria-label="Rewind"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rewind-dial" style={{ left: x, top: y }}>
        <div
          className="rewind-wheel"
          role="slider"
          tabIndex={0}
          aria-label="Rewind history"
          aria-valuemin={0}
          aria-valuemax={total - 1}
          aria-valuenow={index}
          aria-valuetext={`${index} of ${total - 1}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onSeek(index - 1);
            }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onSeek(index + 1);
            }
            if (e.key === "Home") onSeek(0);
            if (e.key === "End") onSeek(total - 1);
            if (e.key === "Escape") onClose();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            gesture.current = {
              angle: Math.atan2(
                e.clientY - r.top - r.height / 2,
                e.clientX - r.left - r.width / 2,
              ),
              offset: index,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const g = gesture.current;
            if (!g) return;
            const r = e.currentTarget.getBoundingClientRect();
            const angle = Math.atan2(
              e.clientY - r.top - r.height / 2,
              e.clientX - r.left - r.width / 2,
            );
            g.offset = Math.max(
              0,
              Math.min(
                total - 1,
                g.offset + angleDelta(g.angle, angle) / (Math.PI / 8),
              ),
            );
            g.angle = angle;
            onSeek(Math.round(g.offset));
          }}
          onPointerUp={() => {
            gesture.current = null;
          }}
          onPointerCancel={() => {
            gesture.current = null;
          }}
        >
          <span
            className="rewind-ticks"
            style={{ transform: `rotate(${index * 22.5}deg)` }}
          />
          <span className="rewind-center">
            <Icon name="canvas-shell-rewind-gesture-undo" />
            <span>
              {index} / {total - 1}
            </span>
          </span>
        </div>
        <div className="rewind-actions">
          <IconButton
            label="Rewind backward"
            name="canvas-shell-undo"
            disabled={index === 0}
            onClick={() => onSeek(index - 1)}
          />
          <button onClick={onClose}>Done</button>
          <IconButton
            label="Rewind forward"
            name="canvas-shell-redo"
            disabled={index === total - 1}
            onClick={() => onSeek(index + 1)}
          />
        </div>
      </div>
    </div>
  );
}
