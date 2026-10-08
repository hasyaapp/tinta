import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, X, ImagePlus } from "lucide-react";
import type { Journal, Library } from "../lib/model";
import { asset, coverNames, templateNames } from "../lib/model";
import { IconButton } from "./UI";

// Structure observed in the supplied rename/customize recording: an inline
// title, the selected book, and a bottom sheet. The system keyboard is supplied
// by the browser/device and is intentionally not painted as a fake keyboard.
export default function JournalCustomizer({
  journal,
  library,
  onChange,
  onPhoto,
  onClose,
}: {
  journal: Journal;
  library: Library;
  onChange: (j: Journal) => void;
  onPhoto: () => void;
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<"menu" | "cover" | "band" | "template">(
    "menu",
  );
  const root = useRef<HTMLElement>(null),
    input = useRef<HTMLInputElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    root.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const controls = Array.from(
            root.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input",
            ),
          ).filter((el) => el.offsetParent !== null),
          first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      previous?.focus();
    };
  }, []);
  return (
    <section
      ref={root}
      className="journal-customizer"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Customize Journal"
    >
      <div className="inline-journal-name">
        <input
          ref={input}
          aria-label="Journal name"
          maxLength={100}
          value={journal.title}
          onChange={(e) => onChange({ ...journal, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
        />
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <div className="customize-bottom-sheet">
        <header>
          {panel !== "menu" && (
            <IconButton
              label="Back to customization"
              onClick={() => setPanel("menu")}
            >
              <ArrowLeft size={17} />
            </IconButton>
          )}
          <h2>
            {panel === "menu"
              ? "Customize Journal"
              : panel === "cover"
                ? "Choose a Cover"
                : panel === "band"
                  ? "Cover Band Color"
                  : "Page Template"}
          </h2>
          <IconButton label="Close cover options" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        {panel === "menu" ? (
          <div className="customize-category-row">
            {[
              { id: "cover", label: "Cover Image", image: "change-cover" },
              {
                id: "band",
                label: "Cover Band Color",
                image: "change-cover-band",
              },
              {
                id: "template",
                label: "Page Template",
                image: "change-page-template",
              },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPanel(item.id as typeof panel)}
              >
                <img
                  src={asset("journal-customization-" + item.image)}
                  alt=""
                />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ) : panel === "cover" ? (
          <div className="cover-options">
            <h3 className="cover-group">Custom</h3>
            <div className="cover-options-row">
              <button className="photo-cover-option" onClick={onPhoto}>
                <ImagePlus />
                <span>Use a photo</span>
              </button>
            </div>
            {[
              { label: "Colors Set", groups: ["default", "gradient"] },
              { label: "Geometric Set", groups: ["geometric"] },
              { label: "Patterns", groups: ["patterns"] },
              { label: "Student", groups: ["student"] },
            ].map((set) => (
              <Fragment key={set.label}>
                <h3 className="cover-group">{set.label}</h3>
                <div className="cover-options-row">
                  {coverNames
                    .filter((n) => set.groups.includes(n.split("-")[1]))
                    .map((n) => (
                      <button
                        key={n}
                        aria-label={"Use " + n + " cover"}
                        aria-pressed={journal.cover === asset(n)}
                        onClick={() =>
                          onChange({ ...journal, cover: asset(n) })
                        }
                      >
                        <img src={asset(n)} alt="" />
                      </button>
                    ))}
                </div>
              </Fragment>
            ))}
          </div>
        ) : panel === "band" ? (
          <div className="cover-band-options">
            <label>
              Cover band color
              <input
                type="color"
                aria-label="Cover band color"
                value={journal.band}
                onChange={(e) => onChange({ ...journal, band: e.target.value })}
              />
            </label>
            {library.palettes[0].filter(Boolean).map((c, i) => (
              <button
                key={i}
                aria-label={"Set band color " + c}
                style={{ background: c }}
                onClick={() => onChange({ ...journal, band: c })}
              />
            ))}
          </div>
        ) : (
          <div className="cover-template-options">
            <button onClick={() => onChange({ ...journal, template: "" })}>
              Plain
            </button>
            {templateNames.map((n) => (
              <button
                key={n}
                aria-label={"Default template " + n}
                aria-pressed={journal.template === n}
                onClick={() => onChange({ ...journal, template: n })}
              >
                <img src={asset("Journal/Templates/Thumbnails/" + n)} alt="" />
                <span>{n.replaceAll("-", " ")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
