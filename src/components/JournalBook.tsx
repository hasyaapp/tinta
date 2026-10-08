import type { CSSProperties } from "react";
import type { Journal, Library, Page } from "../lib/model";
import PagePreview from "./PagePreview";

export const COVER_DURATION = 560;
// Measured from the supplied flip recording: the sheet travels gutter to gutter
// in roughly 0.9-1.1 s. The clip may have been retimed, so this is an estimate.
export const PAGE_TURN_DURATION = 900;

export function CoverBoard({ journal }: { journal: Journal }) {
  return (
    <div
      className="book-cover"
      style={{ backgroundImage: `url("${journal.cover}")` }}
    >
      <div className="book-band" style={{ backgroundColor: journal.band }} />
      <div className="book-spine" />
      {journal.lock && (
        <span className="book-lock" aria-label="Locked journal">
          ⌑
        </span>
      )}
    </div>
  );
}

/** Each side shows its own half of the same drawing, including photos/notes. */
export function PageHalf({
  page,
  templates,
  side,
}: {
  page?: Page;
  templates: Library["templates"];
  side: "left" | "right";
}) {
  return (
    <div className={`leaf-content leaf-content-${side}`}>
      <PagePreview page={page} templates={templates} />
    </div>
  );
}

export function FoldedSpread({
  page,
  templates,
  band,
  first = false,
  last = false,
}: {
  page?: Page;
  templates: Library["templates"];
  band: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="folded-spread"
      style={{ "--binding": band } as CSSProperties}
    >
      {first && <div className="spread-binding binding-left" />}
      {last && <div className="spread-binding binding-right" />}
      <div className="spread-leaf leaf-left">
        <PageHalf page={page} templates={templates} side="left" />
      </div>
      <div className="spread-leaf leaf-right">
        <PageHalf page={page} templates={templates} side="right" />
      </div>
    </div>
  );
}

export function TurningPage({
  from,
  to,
  direction,
  templates,
}: {
  from: Page;
  to: Page;
  direction: 1 | -1;
  templates: Library["templates"];
}) {
  const side = direction === 1 ? "right" : "left";
  return (
    <div
      className={`page-turn-scene ${direction === 1 ? "forward" : "backward"}`}
      aria-hidden="true"
      style={{ "--turn-duration": `${PAGE_TURN_DURATION}ms` } as CSSProperties}
    >
      <div
        className={`turn-stationary spread-leaf leaf-${side === "right" ? "left" : "right"}`}
      >
        <PageHalf
          page={from}
          templates={templates}
          side={side === "right" ? "left" : "right"}
        />
      </div>
      <div className="turn-leaf">
        <div className={`turn-face turn-front leaf-${side}`}>
          <PageHalf page={from} templates={templates} side={side} />
        </div>
        <div
          className={`turn-face turn-back leaf-${side === "right" ? "left" : "right"}`}
        >
          <PageHalf
            page={to}
            templates={templates}
            side={side === "right" ? "left" : "right"}
          />
        </div>
      </div>
    </div>
  );
}

/** One continuous object: closed cover -> edge-on book -> two open leaves.
 * Uses the same dimensions, crop and leaf angles as the resting states. */
export default function JournalTransition({
  kind,
  journal,
  page,
  templates,
}: {
  kind: "open" | "close";
  journal: Journal;
  page?: Page;
  templates: Library["templates"];
}) {
  return (
    <div
      className={`cover-flip ${kind}`}
      aria-hidden="true"
      style={
        {
          "--binding": journal.band,
          "--cover-duration": `${COVER_DURATION}ms`,
        } as CSSProperties
      }
    >
      <div className="opening-book">
        <div className="opening-back">
          <div className="opening-page-block" />
          <div className="opening-inside">
            <PageHalf page={page} templates={templates} side="right" />
          </div>
        </div>
        <div className="opening-front">
          <div className="opening-cover">
            <CoverBoard journal={journal} />
          </div>
          <div className="opening-lining">
            <PageHalf page={page} templates={templates} side="left" />
          </div>
        </div>
      </div>
    </div>
  );
}
