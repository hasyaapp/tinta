import {
  Check,
  Clipboard,
  Copy,
  RotateCw,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { IconButton } from "../UI";

interface SelectionActionsProps {
  kind: "ink" | "photo";
  onApply: () => void;
  onDuplicate: () => void;
  onClip: () => void;
  onRotate: () => void;
  onCutOut: () => void;
  onBringToFront: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export default function SelectionActions({
  kind,
  onApply,
  onDuplicate,
  onClip,
  onRotate,
  onCutOut,
  onBringToFront,
  onDelete,
  onCancel,
}: SelectionActionsProps) {
  return (
    <div className="selection-actions">
      <IconButton label="Apply selection" onClick={onApply}>
        <Check size={20} />
      </IconButton>
      <IconButton label="Duplicate selection" onClick={onDuplicate}>
        <Copy size={18} />
      </IconButton>
      <IconButton label="Save selection as clip" onClick={onClip}>
        <Clipboard size={18} />
      </IconButton>
      <IconButton label="Rotate selection" onClick={onRotate}>
        <RotateCw size={18} />
      </IconButton>
      {kind === "photo" && (
        <IconButton label="Cut out image" onClick={onCutOut}>
          <Scissors size={18} />
        </IconButton>
      )}
      {kind === "photo" && (
        <IconButton label="Bring image to front" onClick={onBringToFront}>
          ↑
        </IconButton>
      )}
      <IconButton label="Delete selection" onClick={onDelete}>
        <Trash2 size={18} />
      </IconButton>
      <IconButton label="Cancel selection" onClick={onCancel}>
        <X size={18} />
      </IconButton>
    </div>
  );
}
