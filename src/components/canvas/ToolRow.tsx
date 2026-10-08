import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { BrushSize, Tool } from "../../lib/model";
import { asset, tools } from "../../lib/model";
import { mixColors } from "../../lib/color";
import type { ColorDragApi } from "./useColorDrag";

export interface SizeGestureApi {
  start: (e: ReactPointerEvent<HTMLButtonElement>, id: Tool) => void;
  move: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  end: () => void;
  ignoreClick: RefObject<boolean>;
}

interface ToolRowProps {
  tool: Tool;
  sizes: Partial<Record<Tool, BrushSize>>;
  color: string;
  mixedColor: RefObject<string>;
  colorDrag: ColorDragApi;
  sizeGesture: SizeGestureApi;
  onChooseTool: (id: Tool) => void;
  onErasePanel: () => void;
  onMixColor: (hex: string) => void;
  onToggleColorOpen: () => void;
}

export default function ToolRow({
  tool,
  sizes,
  color,
  mixedColor,
  colorDrag,
  sizeGesture,
  onChooseTool,
  onErasePanel,
  onMixColor,
  onToggleColorOpen,
}: ToolRowProps) {
  const mixer = useRef<{
    angle: number;
    amount: number;
    from: string;
    to: string;
  } | null>(null);
  return (
    <div className="tools-scroll">
      <div className="tools-row">
        {tools.slice(0, 10).map((t) => (
          <button
            key={t.id}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            title={t.label + (t.key ? " (" + t.key + ")" : "")}
            className={
              "drawing-tool tool-" +
              t.id +
              " " +
              (tool === t.id ? "selected" : "")
            }
            onPointerDown={
              t.sized ? (e) => sizeGesture.start(e, t.id) : undefined
            }
            onPointerMove={t.sized ? sizeGesture.move : undefined}
            onPointerUp={t.sized ? sizeGesture.end : undefined}
            onPointerCancel={t.sized ? sizeGesture.end : undefined}
            onClick={() => {
              if (sizeGesture.ignoreClick.current) {
                sizeGesture.ignoreClick.current = false;
                return;
              }
              onChooseTool(t.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (t.id === "erase") onErasePanel();
            }}
          >
            <img
              draggable={false}
              alt=""
              src={asset(
                "canvas-tray-" +
                  t.id +
                  "-" +
                  (tool === t.id ? "selected" : "unselected") +
                  (t.sized ? "-" + (sizes[t.id] || "md") : ""),
              )}
            />
            <span className="tool-tooltip">{t.label}</span>
          </button>
        ))}
        <button
          className="color-mixer"
          aria-label="Color mixer"
          title="Stir to mix colors"
          onPointerDown={(e) => {
            colorDrag.start(e, mixedColor.current, 500);
            const r = e.currentTarget.getBoundingClientRect();
            mixer.current = {
              angle: Math.atan2(
                e.clientY - r.top - r.height / 2,
                e.clientX - r.left - r.width / 2,
              ),
              amount: 0,
              from: mixedColor.current,
              to: color,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (colorDrag.move(e)) return;
            const m = mixer.current;
            if (!m) return;
            const r = e.currentTarget.getBoundingClientRect(),
              a = Math.atan2(
                e.clientY - r.top - r.height / 2,
                e.clientX - r.left - r.width / 2,
              );
            let delta = a - m.angle;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;
            m.amount = Math.max(
              0,
              Math.min(1, m.amount + delta / (Math.PI * 2)),
            );
            m.angle = a;
            const c = mixColors(m.from, m.to, m.amount);
            onMixColor(c);
            mixedColor.current = c;
          }}
          onPointerCancel={() => {
            colorDrag.end();
            mixer.current = null;
          }}
          onPointerUp={(e) => {
            if (colorDrag.end(e)) {
              mixer.current = null;
              return;
            }
            if (mixer.current && mixer.current.amount < 0.01)
              onToggleColorOpen();
            mixer.current = null;
          }}
        >
          <span className="mixer-rim">
            <span
              style={{
                background:
                  "conic-gradient(" +
                  color +
                  " 0deg 205deg, " +
                  mixedColor.current +
                  " 210deg 355deg, " +
                  color +
                  " 360deg)",
              }}
            />
          </span>
        </button>
        {tools.slice(10).map((t) => (
          <button
            key={t.id}
            aria-label={t.label}
            title={t.label}
            className={
              "drawing-tool tool-" +
              t.id +
              " " +
              (tool === t.id ? "selected" : "")
            }
            onClick={() => onChooseTool(t.id)}
          >
            <img
              draggable={false}
              alt=""
              src={asset(
                "canvas-tray-" +
                  t.id +
                  "-" +
                  (tool === t.id ? "selected" : "unselected"),
              )}
            />
            <span className="tool-tooltip">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
