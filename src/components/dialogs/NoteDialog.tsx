import type { Page } from "../../lib/model";
import { Modal } from "../UI";

interface NoteDialogProps {
  page: Page;
  onChange: (p: Page) => void;
  onClose: () => void;
}

export default function NoteDialog({ page, onChange, onClose }: NoteDialogProps) {
  return (
    <Modal title="A note for this page" onClose={onClose}>
      <div className="note-tools">
        <button onClick={() => onChange({ ...page, note: page.note + "\n• " })}>
          • List
        </button>
        <button onClick={() => onChange({ ...page, note: page.note + "\n☐ " })}>
          ☐ Checklist
        </button>
        <button className="danger" onClick={() => onChange({ ...page, note: "" })}>
          Clear
        </button>
      </div>
      <textarea
        className="note-editor"
        aria-label="Page note"
        placeholder="Put your thoughts into words…"
        value={page.note}
        onChange={(e) => onChange({ ...page, note: e.target.value })}
      />
      <button className="primary-button" onClick={onClose}>
        Done
      </button>
    </Modal>
  );
}
