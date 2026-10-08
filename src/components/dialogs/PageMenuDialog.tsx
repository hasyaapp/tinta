import { FileText, Trash2 } from "lucide-react";
import type { Page } from "../../lib/model";
import { Icon, Modal } from "../UI";

interface PageMenuDialogProps {
  page: Page;
  pageNumber: number;
  onDuplicate: () => void;
  onMove: () => void;
  onNote: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function PageMenuDialog({
  page,
  pageNumber,
  onDuplicate,
  onMove,
  onNote,
  onRotate,
  onDelete,
  onClose,
}: PageMenuDialogProps) {
  return (
    <Modal title={"Page " + pageNumber} onClose={onClose}>
      <button className="menu-row" onClick={onDuplicate}>
        <Icon name="shell-control-strip-duplicate" />
        <span>Duplicate page</span>
      </button>
      <button className="menu-row" onClick={onMove}>
        <Icon name="shell-control-strip-move" />
        <span>Move to another journal</span>
      </button>
      <button className="menu-row" onClick={onNote}>
        <FileText size={20} />
        <span>{page.note ? "Edit note" : "Add a text note"}</span>
      </button>
      <button className="menu-row" onClick={onRotate}>
        <Icon name="shell-control-strip-rotate" />
        <span>Rotate page</span>
      </button>
      <button className="menu-row danger" onClick={onDelete}>
        <Trash2 size={20} />
        <span>Delete page</span>
      </button>
    </Modal>
  );
}
