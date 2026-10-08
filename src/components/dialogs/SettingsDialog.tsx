import { Download, HelpCircle, Upload } from "lucide-react";
import type { Library, Settings } from "../../lib/model";
import { resetDefaultPalettes } from "../../lib/library";
import { Icon, Modal, Toggle } from "../UI";

const canvasToggles = [
  [
    "fingerDraw",
    "Draw with your finger",
    "Use touch to draw, or switch off for Pencil only.",
  ],
  [
    "cleanCanvas",
    "Clean Canvas Mode",
    "Hide canvas buttons while you draw.",
  ],
  [
    "showGrid",
    "Show Grid While Zooming",
    "A little guidance for the finer details.",
  ],
  [
    "exportBackground",
    "Export with Background Color",
    "Include the page color in PNG and PDF exports.",
  ],
] as const;

interface SettingsDialogProps {
  settings: Settings;
  update: (fn: (l: Library) => Library) => void;
  notify: (message: string) => void;
  onBackup: () => void;
  onRestoreClick: () => void;
  onHelp: () => void;
  onClose: () => void;
}

export default function SettingsDialog({
  settings,
  update,
  notify,
  onBackup,
  onRestoreClick,
  onHelp,
  onClose,
}: SettingsDialogProps) {
  return (
    <Modal title="Settings" onClose={onClose}>
      <section className="settings-section">
        <span className="section-label">CANVAS</span>
        {canvasToggles.map(([key, label, detail]) => (
          <Toggle
            key={key}
            label={label}
            detail={detail}
            value={settings[key]}
            onChange={(v) =>
              update((l) => ({
                ...l,
                settings: { ...l.settings, [key]: v },
              }))
            }
          />
        ))}
      </section>
      <section className="settings-section">
        <span className="section-label">COLORS</span>
        <button
          className="menu-row"
          onClick={() => {
            update(resetDefaultPalettes);
            notify("Default palettes are back");
          }}
        >
          <Icon name="canvas-tray-add-palette" />
          <span>
            Reset default palettes
            <small>
              Restore the first five palettes and keep your custom palettes
            </small>
          </span>
        </button>
      </section>
      <section className="settings-section">
        <span className="section-label">YOUR JOURNALS</span>
        <button className="menu-row" onClick={onBackup}>
          <Download size={19} />
          <span>
            Export a backup
            <small>All journals, drawings, notes, and palettes</small>
          </span>
        </button>
        <button className="menu-row" onClick={onRestoreClick}>
          <Upload size={19} />
          <span>Restore a backup</span>
        </button>
        <button className="menu-row" onClick={onHelp}>
          <HelpCircle size={19} />
          <span>How to use Tinta</span>
        </button>
      </section>
      <p className="settings-footnote">
        Your work stays on this device. Keep a backup of the things you love.
      </p>
    </Modal>
  );
}
