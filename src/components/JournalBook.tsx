import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Journal, Library, Page } from "../lib/model";
import { composePage } from "../lib/images";
import { bookMotion } from "../engine/book/motion";
import type { MotionHandle } from "../engine/book/motion";
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

/** The turning sheet. With WebGL available, the shared motion layer bends the
 *  paper cylindrically around the turn; the wrapper then only carries the
 *  stationary covering leaf. Progress is state, so `back` reverses a turn in
 *  flight. Without WebGL the original CSS keyframe leaf plays instead. */
export function TurningPage({
  from,
  to,
  direction,
  templates,
  back = false,
  onDone,
}: {
  from: Page;
  to: Page;
  direction: 1 | -1;
  templates: Library["templates"];
  back?: boolean;
  onDone?: () => void;
}) {
  // The mechanism is chosen once per mounted turn; a context lost mid-flight
  // settles the WebGL animation instead of switching mechanisms.
  const [gl, setGl] = useState(() => bookMotion.ready);
  const scene = useRef<HTMLDivElement>(null);
  const handle = useRef<MotionHandle | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const art = useRef({ from, to, templates });
  art.current = { from, to, templates };

  useLayoutEffect(() => {
    if (!gl) return;
    const { from, to, templates } = art.current;
    const played = bookMotion.playPageTurn({
      scene: scene.current!,
      direction,
      duration: PAGE_TURN_DURATION,
      front: composePage(from, true, templates).catch(() => null),
      back: composePage(to, true, templates).catch(() => null),
      onSettle: () => done.current?.(),
    });
    if (!played) {
      setGl(false);
      return;
    }
    handle.current = played;
    return () => {
      handle.current = null;
      played.release();
    };
  }, [gl, direction]);

  useLayoutEffect(() => {
    handle.current?.setTarget(back ? 0 : 1);
  }, [back]);

  // The CSS keyframes are one-shot; they finish on the shared timer.
  useEffect(() => {
    if (gl) return;
    const timer = setTimeout(() => done.current?.(), PAGE_TURN_DURATION);
    return () => clearTimeout(timer);
  }, [gl]);

  const side = direction === 1 ? "right" : "left";
  return (
    <div
      ref={scene}
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
      {!gl && (
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
      )}
    </div>
  );
}

/** One continuous object: closed cover -> edge-on book -> two open leaves.
 * Uses the same dimensions, crop and leaf angles as the resting states.
 * With WebGL the shared motion layer renders the flexing boards; the hidden
 * probes resolve the keyframes' calc() boxes to measured rectangles. Without
 * WebGL the original CSS keyframe book plays as the fallback. */
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
  const [gl, setGl] = useState(() => bookMotion.ready);
  const wrapper = useRef<HTMLDivElement>(null);
  const closedProbe = useRef<HTMLDivElement>(null);
  const openProbe = useRef<HTMLDivElement>(null);
  const art = useRef({ journal, page, templates });
  art.current = { journal, page, templates };

  useLayoutEffect(() => {
    if (!gl) return;
    const { journal, page, templates } = art.current;
    const played = bookMotion.playCover({
      wrapper: wrapper.current!,
      closedProbe: closedProbe.current!,
      openProbe: openProbe.current!,
      kind,
      duration: COVER_DURATION,
      cover: journal.cover,
      band: journal.band,
      page: page ? composePage(page, true, templates).catch(() => null) : null,
      // App commits the view switch on its own COVER_DURATION timer.
      onSettle: () => {},
    });
    if (!played) {
      setGl(false);
      return;
    }
    return () => played.release();
  }, [gl, kind]);

  return (
    <div
      ref={wrapper}
      className={`cover-flip ${kind}`}
      aria-hidden="true"
      style={
        {
          "--binding": journal.band,
          "--cover-duration": `${COVER_DURATION}ms`,
        } as CSSProperties
      }
    >
      {gl ? (
        <>
          <div ref={closedProbe} className="cover-probe cover-probe-closed" />
          <div ref={openProbe} className="cover-probe cover-probe-open" />
        </>
      ) : (
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
      )}
    </div>
  );
}
