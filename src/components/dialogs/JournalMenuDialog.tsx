import { LockKeyhole, Trash2 } from "lucide-react";
import type { Journal } from "../../lib/model";
import { Icon, Modal } from "../UI";

interface JournalMenuDialogProps {
  journal: Journal;
  onDuplicate: () => void;
  onLock: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function JournalMenuDialog({
  journal,
  onDuplicate,
  onLock,
  onExport,
  onDelete,
  onClose,
}: JournalMenuDialogProps) {
  return (
    <Modal title={journal.title} onClose={onClose}>
      <button className="menu-row" onClick={onDuplicate}>
        <Icon name="shell-control-strip-duplicate" />
        <span>Duplicate journal</span>
      </button>
      <button className="menu-row" onClick={onLock}>
        <LockKeyhole size={20} />
        <span>{journal.lock ? "Remove lock" : "Add lock"}</span>
      </button>
      <button className="menu-row" onClick={onExport}>
        <Icon name="shell-control-strip-share" />
        <span>Export journal</span>
      </button>
      <button className="menu-row danger" onClick={onDelete}>
        <Trash2 size={20} />
        <span>Delete journal</span>
      </button>
    </Modal>
  );
}
