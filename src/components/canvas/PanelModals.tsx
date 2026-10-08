import { Clipboard, Scissors, Trash2, X } from "lucide-react";
import type { Clip } from "../../lib/model";
import { Icon, Modal } from "../UI";

interface PanelModalsProps {
  panel: "clips" | "collage" | "erase";
  clips: Clip[];
  onUseClip: (c: Clip) => void;
  onDeleteClip: (id: string) => void;
  onChooseCut: () => void;
  onAddPhotos: () => void;
  onOpenClips: () => void;
  eraseActions: { label: string; action: () => void }[];
  onClose: () => void;
}

export default function PanelModals({
  panel,
  clips,
  onUseClip,
  onDeleteClip,
  onChooseCut,
  onAddPhotos,
  onOpenClips,
  eraseActions,
  onClose,
}: PanelModalsProps) {
  if (panel === "clips")
    return (
      <Modal title="Canvas Clips" onClose={onClose}>
        {clips.length ? (
          <div className="clip-grid">
            {clips.map((c) => (
              <div key={c.id}>
                <button aria-label="Use saved clip" onClick={() => onUseClip(c)}>
                  <img src={c.src} alt="Saved artwork" />
                </button>
                <button
                  aria-label="Delete saved clip"
                  onClick={() => onDeleteClip(c.id)}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <Scissors size={35} />
            <h3>Keep a little inspiration.</h3>
            <p>Cut out part of a drawing, then save it here to use again.</p>
            <button className="primary-button" onClick={onChooseCut}>
              Choose the Cut tool
            </button>
          </div>
        )}
      </Modal>
    );
  if (panel === "collage")
    return (
      <Modal title="Bring it all together" onClose={onClose}>
        <button className="menu-row" onClick={onAddPhotos}>
          <Icon name="canvas-tray-collage-photos" />
          <span>
            Add photos<small>Choose one image or a whole collection</small>
          </span>
        </button>
        <button className="menu-row" onClick={onOpenClips}>
          <Clipboard size={22} />
          <span>Use a Canvas Clip</span>
        </button>
        <p className="muted">
          You can also drop images directly onto your page. Tap an image with
          the Collage tool to move, resize, or rotate it.
        </p>
      </Modal>
    );
  return (
    <Modal title="A fresh start" onClose={onClose}>
      {eraseActions.map((a) => (
        <button
          key={a.label}
          className="menu-row"
          onClick={() => {
            a.action();
            onClose();
          }}
        >
          <Trash2 size={19} />
          <span>{a.label}</span>
        </button>
      ))}
      <p className="muted">You can undo any of these changes.</p>
    </Modal>
  );
}
