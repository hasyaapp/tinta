import { FileText, ImagePlus } from "lucide-react";
import { Modal, Toggle } from "../UI";

interface ExportDialogProps {
  mode: "page" | "journal";
  busy: boolean;
  exportBackground: boolean;
  onExportBackground: (v: boolean) => void;
  onPNG: () => void;
  onPDF: () => void;
  onClose: () => void;
}

export default function ExportDialog({
  mode,
  busy,
  exportBackground,
  onExportBackground,
  onPNG,
  onPDF,
  onClose,
}: ExportDialogProps) {
  return (
    <Modal
      title={mode === "journal" ? "Share your journal" : "Share your idea"}
      onClose={onClose}
    >
      <div className="export-options">
        {mode === "page" && (
          <button disabled={busy} onClick={onPNG}>
            <ImagePlus size={28} />
            <strong>PNG image</strong>
            <span>A picture of this page</span>
          </button>
        )}
        <button disabled={busy} onClick={onPDF}>
          <FileText size={28} />
          <strong>PDF document</strong>
          <span>{mode === "page" ? "This page" : "Every idea, in order"}</span>
        </button>
      </div>
      <Toggle
        label="Include background color"
        value={exportBackground}
        onChange={onExportBackground}
      />
      {busy && <p className="muted">Preparing your export…</p>}
    </Modal>
  );
}
