import type { RefObject } from "react";
import { Download, FileText, MoreHorizontal } from "lucide-react";
import type { BrushSize, Tool } from "../../lib/model";
import { Icon, IconButton } from "../UI";

export interface ToolGesture {
  id: Tool;
  y: number;
  size: BrushSize;
  changed: boolean;
  timer: number | null;
}

interface CanvasHeaderProps {
  cleanCanvas: boolean;
  canUndo: boolean;
  canRedo: boolean;
  // Shared with the tool tray's size gesture; the long-press undo reuses
  // toolGesture/ignoreToolClick, so cross-talk with tray clicks is intentional.
  toolGesture: RefObject<ToolGesture | null>;
  ignoreToolClick: RefObject<boolean>;
  onSizeGestureEnd: () => void;
  onOpenRewind: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
  onTranscribe: () => void;
  onNote: () => void;
  onExport: () => void;
  onSettings: () => void;
  onShowControls: () => void;
}

export default function CanvasHeader({
  cleanCanvas,
  canUndo,
  canRedo,
  toolGesture,
  ignoreToolClick,
  onSizeGestureEnd,
  onOpenRewind,
  onUndo,
  onRedo,
  onClose,
  onTranscribe,
  onNote,
  onExport,
  onSettings,
  onShowControls,
}: CanvasHeaderProps) {
  if (cleanCanvas)
    return (
      <button
        className="clean-exit"
        aria-label="Show canvas controls"
        onClick={onShowControls}
      >
        <MoreHorizontal size={20} />
      </button>
    );
  return (
    <header className="canvas-header">
      <div>
        <IconButton
          label="Close canvas"
          name="canvas-shell-close"
          onClick={onClose}
        />
      </div>
      <div className="canvas-top-actions">
        <button
          className="canvas-pill"
          aria-label="Convert to text"
          onClick={onTranscribe}
        >
          <Icon name="canvas-shell-transcribe" />
          <span>Convert to text</span>
        </button>
        <IconButton label="Add a note" onClick={onNote}>
          <FileText size={19} />
        </IconButton>
        <button
          className="canvas-pill"
          aria-label="Export drawing"
          onClick={onExport}
        >
          <Download size={16} />
          <span>Export</span>
        </button>
        <div
          className="rewind-trigger"
          onContextMenu={(e) => {
            e.preventDefault();
            onSizeGestureEnd();
            onOpenRewind();
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            ignoreToolClick.current = false;
            toolGesture.current = {
              id: "draw",
              y: 0,
              size: "md",
              changed: false,
              timer: window.setTimeout(() => {
                ignoreToolClick.current = true;
                onOpenRewind();
              }, 500),
            };
          }}
          onPointerUp={onSizeGestureEnd}
          onPointerCancel={onSizeGestureEnd}
          onPointerLeave={onSizeGestureEnd}
        >
          <IconButton
            label="Undo"
            name="canvas-shell-undo"
            disabled={!canUndo}
            onClick={() => {
              if (ignoreToolClick.current) {
                ignoreToolClick.current = false;
                return;
              }
              onUndo();
            }}
          />
        </div>
        <IconButton
          label="Redo"
          name="canvas-shell-redo"
          disabled={!canRedo}
          onClick={onRedo}
        />
        <IconButton
          label="Canvas settings"
          name="shell-settings"
          onClick={onSettings}
        />
      </div>
    </header>
  );
}
