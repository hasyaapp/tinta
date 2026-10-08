import { FileDown, FileText, ImagePlus, Share2 } from "lucide-react";
import { Modal, Toggle } from "../UI";

interface ExportDialogProps {
  mode: "page" | "journal";
  busy: boolean;
  exportBackground: boolean;
  onExportBackground: (v: boolean) => void;
  onPNG: () => void;
  onPDF: () => void;
  onFile: () => void;
  onShare: (() => void) | null;
  onClose: () => void;
}

export default function ExportDialog({
  mode,
  busy,
  exportBackground,
  onExportBackground,
  onPNG,
  onFile,
  onShare,
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
        {mode === "journal" && (
          <button disabled={busy} onClick={onFile}>
            <FileDown size={28} />
            <strong>Tinta file</strong>
            <span>Open this journal on another device</span>
          </button>
        )}
        {mode === "journal" && onShare && (
          <button disabled={busy} onClick={onShare}>
            <Share2 size={28} />
            <strong>Share</strong>
            <span>Send the journal file to another app</span>
          </button>
        )}
      </div>
      <Toggle
        label="Include background color"
        value={exportBackground}
        onChange={onExportBackground}
      />
      {busy && <p className="muted">Getting it ready…</p>}
    </Modal>
  );
}
