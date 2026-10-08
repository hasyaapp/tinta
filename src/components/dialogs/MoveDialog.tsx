import type { Journal } from "../../lib/model";
import { Modal } from "../UI";

interface MoveDialogProps {
  journals: Journal[];
  onPick: (j: Journal) => void;
  onClose: () => void;
}

export default function MoveDialog({ journals, onPick, onClose }: MoveDialogProps) {
  return (
    <Modal title="Move to journal" onClose={onClose}>
      {journals.map((j) => (
        <button key={j.id} className="menu-row" onClick={() => onPick(j)}>
          <img className="mini-cover" src={j.cover} alt="" />
          <span>{j.title}</span>
        </button>
      ))}
    </Modal>
  );
}
