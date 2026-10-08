import type { Library } from "../lib/model";
import { asset, templateNames, templateLabel } from "../lib/model";
import { Plus, X, Check } from "lucide-react";
export default function TemplateStrip({
  library,
  selected,
  onSelect,
  onCapture,
  onClose,
  onDefault,
  onDelete,
}: {
  library: Library;
  selected: string;
  onSelect: (name: string) => void;
  onCapture: () => void;
  onClose: () => void;
  onDefault: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section
      className="template-tray-panel"
      role="region"
      aria-label="Canvas templates"
    >
      <button
        className="tray-panel-close"
        aria-label="Close templates"
        onClick={onClose}
      >
        <X size={16} />
      </button>
      <div className="template-strip">
        <button
          className="template-capture"
          aria-label="Capture template"
          onClick={onCapture}
        >
          <span>Capture Template</span>
          <div className="template-tile">
            <Plus size={32} />
          </div>
        </button>
        <button
          aria-label="Plain"
          aria-pressed={!selected}
          onClick={() => onSelect("")}
        >
          <span>Plain</span>
          <div className="template-tile plain">
            {!selected && <Check className="template-check" size={18} />}
          </div>
        </button>
        {templateNames.map((n) => (
          <button
            key={n}
            aria-label={templateLabel(n)}
            aria-pressed={selected === n}
            onClick={() => onSelect(n)}
          >
            <span>{templateLabel(n)}</span>
            <div
              className={
                "template-tile " +
                (n.startsWith("storyboard") ? "storyboard" : "")
              }
            >
              <img src={asset("Journal/Templates/Thumbnails/" + n)} alt="" />
              {selected === n && <Check className="template-check" size={18} />}
            </div>
          </button>
        ))}
        {library.templates.map((t, i) => (
          <div className="saved-template" key={t.id}>
            <button
              aria-label={"Use custom template " + (i + 1)}
              onClick={() => onSelect(t.id)}
            >
              <span>My Template {i + 1}</span>
              <div className="template-tile">
                <img src={t.src} alt="" />
              </div>
            </button>
            <button
              className="delete-template"
              aria-label={"Delete custom template " + (i + 1)}
              onClick={() => onDelete(t.id)}
            >
              <X size={15} />
            </button>
          </div>
        ))}
        <button className="template-default" onClick={onDefault}>
          <span>Journal Default</span>
          <div className="template-tile">
            <Check size={28} />
          </div>
        </button>
      </div>
    </section>
  );
}
