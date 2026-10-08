import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { asset } from "../lib/model";
import type { Library } from "../lib/model";
import { IconButton } from "./UI";
import PagePreview from "./PagePreview";
import ShelfCanvas from "./ShelfCanvas";
import {
  CoverBoard,
  FoldedSpread,
  TurningPage,
} from "./JournalBook";
import { bookMotion } from "../engine/book/motion";
/** Cards fanned on each side of the open spread, as in the reference. */
const FAN_DEPTH = 7;
/** Placement of the card `d` steps from the open spread. Measured from the
 *  reference: each card protrudes 0.144, 0.223, 0.291… spread-widths past the
 *  spread's edge and shrinks ~4.5% per step. */
function fanPlacement(d: number) {
  if (d === 0) return { shift: 0, scale: 1 };
  const n = Math.abs(d);
  const scale = Math.max(0.64, 0.97 - 0.045 * n);
  const protrude = 0.07 + 0.072 * n - 0.0012 * n * n;
  return { shift: Math.sign(d) * (protrude + (1 - scale) / 2), scale };
}
export function Home({
  library,
  shelfState,
  onSelect,
  onOpen,
  onAdd,
  onEdit,
  onDelete,
  onMenu,
  onExport,
}: {
  library: Library;
  shelfState: string;
  onSelect: (i: number) => void;
  onOpen: () => void;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMenu: () => void;
  onExport: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null),
    swiped = useRef(false),
    wheel = useRef(0);
  const journal = library.journals[library.selected];
  const step = (dir: number) =>
    onSelect(
      Math.max(
        0,
        Math.min(library.journals.length - 1, library.selected + dir),
      ),
    );
  return (
    <section
      className="home-scene"
      aria-label="Journal library"
      onWheel={(e) => {
        wheel.current += e.deltaY + e.deltaX;
        if (Math.abs(wheel.current) < 50) return;
        step(wheel.current > 0 ? 1 : -1);
        wheel.current = 0;
      }}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        swiped.current = false;
      }}
      onPointerUp={(e) => {
        if (start.current) {
          const d = e.clientX - start.current.x;
          if (Math.abs(d) > 55) {
            swiped.current = true;
            onSelect(
              Math.max(
                0,
                Math.min(
                  library.journals.length - 1,
                  library.selected + (d < 0 ? 1 : -1),
                ),
              ),
            );
          }
          start.current = null;
        }
      }}
    >
      <div className="journal-heading">
        <button onClick={onEdit} className="title-button">
          <h1>{journal?.title || "A place for your ideas."}</h1>
        </button>
        <p>
          {journal ? (
            <>
              <span className="tiny-pages">▱</span> {journal.pageIds.length}{" "}
              {journal.pageIds.length === 1 ? "Page" : "Pages"}
            </>
          ) : (
            "Start a journal. Make it yours."
          )}
        </p>
      </div>
      <div className="bookshelf">
        <ShelfCanvas
          journals={library.journals}
          layoutKey={`${library.selected}:${shelfState}`}
        />
        {library.journals.map((j, i) => {
          const offset = i - library.selected;
          return (
            <button
              key={j.id}
              tabIndex={Math.abs(offset) > 2 ? -1 : 0}
              aria-label={(offset === 0 ? "Open " : "Select ") + j.title}
              className={"book-position " + (offset === 0 ? "selected" : "")}
              style={
                {
                  "--offset": offset,
                  "--abs": Math.abs(offset),
                  zIndex: 20 - Math.abs(offset),
                } as CSSProperties
              }
              onClick={() => {
                if (swiped.current) return;
                offset === 0 ? onOpen() : onSelect(i);
              }}
            >
              <span className="book-shadow" aria-hidden="true" />
              <div
                className="book"
                style={{ "--binding": j.band } as CSSProperties}
              >
                <div className="book-pages" />
                <CoverBoard journal={j} />
              </div>
            </button>
          );
        })}
        {!journal && (
          <button className="empty-book" onClick={onAdd}>
            <Plus size={40} />
            <span>New journal</span>
          </button>
        )}
      </div>
      {journal && (
        <>
          <button
            className="cover-customize-button"
            aria-label="Customize journal"
            onClick={onEdit}
          >
            <img src={asset("journal-customization")} alt="" />
          </button>
          <button
            className="shelf-arrow shelf-left"
            aria-label="Previous journal"
            disabled={library.selected === 0}
            onClick={() => onSelect(library.selected - 1)}
          >
            <ChevronLeft />
          </button>
          <button
            className="shelf-arrow shelf-right"
            aria-label="Next journal"
            disabled={library.selected === library.journals.length - 1}
            onClick={() => onSelect(library.selected + 1)}
          >
            <ChevronRight />
          </button>
          <div className="home-actions action-strip">
            <IconButton
              label="Journal options"
              name="shell-control-strip-more-menu"
              onClick={onMenu}
            />
            <IconButton
              label="Export journal"
              name="shell-control-strip-share"
              onClick={onExport}
            />
            <IconButton
              label="Delete journal"
              name="shell-control-strip-delete"
              onClick={onDelete}
            />
            <IconButton
              label="New journal"
              name="shell-control-strip-add-journal"
              onClick={onAdd}
            />
          </div>
        </>
      )}
    </section>
  );
}
export function Pages({
  library,
  grid,
  index,
  onIndex,
  onOpen,
  onAdd,
  onMenu,
  onExport,
  onDelete,
  onNote,
  onReorder,
  onBatch,
}: {
  library: Library;
  grid: boolean;
  index: number;
  onIndex: (n: number) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onMenu: () => void;
  onExport: () => void;
  onDelete: () => void;
  onNote: () => void;
  onReorder: (from: string, to: string) => void;
  onBatch: (ids: string[], action: string) => void;
}) {
  const journal = library.journals[library.selected],
    page = library.pages[journal.pageIds[index]];
  const [selecting, setSelecting] = useState(false),
    [numbers, setNumbers] = useState(false),
    [deletePrompt, setDeletePrompt] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (hold.current) clearTimeout(hold.current);
    },
    [],
  );
  const start = useRef<number | null>(null);
  const swipe = useRef(false);
  const wheel = useRef(0);
  const dragged = useRef("");
  // Keep both drawings until the hinged leaf reaches its destination.
  const previousIndex = useRef(index);
  const previousId = useRef(journal.pageIds[index]);
  const [turn, setTurn] = useState<{
    dir: 1 | -1;
    from: string;
    to: string;
    serial: number;
    back: boolean;
  } | null>(null);
  useEffect(() => {
    const from = previousId.current,
      to = journal.pageIds[index];
    const before = previousIndex.current;
    previousIndex.current = index;
    previousId.current = to;
    if (
      grid ||
      !from ||
      !to ||
      from === to ||
      !library.pages[from] ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setTurn(null);
      return;
    }
    setTurn((current) => {
      // A WebGL turn is progress-driven, so stepping back onto the same sheet
      // reverses it in flight instead of restarting a new one.
      if (current && bookMotion.ready) {
        if (current.from === from && current.to === to)
          return { ...current, back: false };
        if (current.from === to && current.to === from)
          return { ...current, back: true };
      }
      return {
        dir: index > before ? 1 : -1,
        from,
        to,
        serial: performance.now(),
        back: false,
      };
    });
  }, [index, journal.pageIds, grid]);
  return (
    <section
      className={"pages-scene " + (grid ? "grid-scene" : "butterfly-scene")}
      aria-label={grid ? "Pages grid" : "Journal pages"}
    >
      <div className="journal-heading">
        <h1>{journal.title}</h1>
        <p>
          {selecting
            ? selected.length + " selected"
            : journal.pageIds.length + " Pages"}
        </p>
      </div>
      {grid ? (
        <div className="page-grid">
          {journal.pageIds.map((id, i) => (
            <button
              key={id}
              aria-label={"Open page " + (i + 1)}
              className={"grid-page " + (selected.includes(id) ? "chosen" : "")}
              draggable={!selecting}
              onDragStart={() => (dragged.current = id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onReorder(dragged.current, id);
                dragged.current = "";
              }}
              onClick={() => {
                onIndex(i);
                if (selecting)
                  setSelected((s) =>
                    s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                  );
                else onOpen(id);
              }}
            >
              <PagePreview
                page={library.pages[id]}
                templates={library.templates}
              />
              {numbers && <span className="page-number">{i + 1}</span>}
              {selecting && (
                <span className="selection-check">
                  {selected.includes(id) ? "✓" : ""}
                </span>
              )}
            </button>
          ))}
          <button className="grid-add" aria-label="New page" onClick={onAdd}>
            <Plus size={26} />
          </button>
        </div>
      ) : (
        <div
          className="butterfly-stack"
          style={
            {
              "--fan-right": Math.min(
                FAN_DEPTH,
                journal.pageIds.length - 1 - index,
              ),
              "--fan-left": Math.min(FAN_DEPTH, index),
            } as CSSProperties
          }
          onWheel={(e) => {
            wheel.current += e.deltaY;
            if (Math.abs(wheel.current) < 50) return;
            onIndex(
              Math.max(
                0,
                Math.min(
                  journal.pageIds.length - 1,
                  index + (wheel.current > 0 ? 1 : -1),
                ),
              ),
            );
            wheel.current = 0;
          }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            swipe.current = false;
          }}
          onPointerUp={(e) => {
            if (
              start.current !== null &&
              Math.abs(e.clientX - start.current) > 50
            ) {
              swipe.current = true;
              onIndex(
                Math.max(
                  0,
                  Math.min(
                    journal.pageIds.length - 1,
                    index + (e.clientX < start.current ? 1 : -1),
                  ),
                ),
              );
            }
            start.current = null;
          }}
        >
          {journal.pageIds.map((id, i) => {
            const d = i - index;
            if (Math.abs(d) > FAN_DEPTH) return null;
            const fan = fanPlacement(d);
            return (
              <button
                key={id}
                className={"spread-page " + (d === 0 ? "current" : "")}
                style={
                  {
                    "--offset": d,
                    "--abs": Math.abs(d),
                    "--fan-shift": fan.shift,
                    "--fan-scale": fan.scale,
                    zIndex: 10 - Math.abs(d),
                  } as CSSProperties
                }
                aria-label={"Open page " + (i + 1)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setDeletePrompt(true);
                }}
                onPointerDown={() => {
                  if (hold.current) clearTimeout(hold.current);
                  hold.current = setTimeout(() => {
                    setDeletePrompt(true);
                    swipe.current = true;
                  }, 550);
                }}
                onPointerMove={(e) => {
                  if (
                    start.current !== null &&
                    Math.abs(e.clientX - start.current) > 12 &&
                    hold.current
                  ) {
                    clearTimeout(hold.current);
                    hold.current = null;
                  }
                }}
                onPointerUp={() => {
                  if (hold.current) clearTimeout(hold.current);
                  hold.current = null;
                }}
                onPointerCancel={() => {
                  if (hold.current) clearTimeout(hold.current);
                  hold.current = null;
                }}
                onClick={() => {
                  if (swipe.current) return;
                  setDeletePrompt(false);
                  d === 0 ? onOpen(id) : onIndex(i);
                }}
              >
                <FoldedSpread
                  page={library.pages[id]}
                  templates={library.templates}
                  band={journal.band}
                  first={i === Math.max(0, index - 6)}
                  last={i === Math.min(journal.pageIds.length - 1, index + 6)}
                />
              </button>
            );
          })}
          {turn && library.pages[turn.from] && library.pages[turn.to] && (
            <TurningPage
              key={turn.serial}
              from={library.pages[turn.from]}
              to={library.pages[turn.to]}
              direction={turn.dir}
              templates={library.templates}
              back={turn.back}
              onDone={() => setTurn(null)}
            />
          )}
          {!page && (
            <button className="blank-spread" onClick={onAdd}>
              <Plus />
              <span>Add your first page</span>
            </button>
          )}
        </div>
      )}
      {!grid && page && (
        <>
          <button
            className="shelf-arrow shelf-left"
            disabled={index === 0}
            aria-label="Previous page"
            onClick={() => onIndex(index - 1)}
          >
            <ChevronLeft />
          </button>
          <button
            className="shelf-arrow shelf-right"
            disabled={index === journal.pageIds.length - 1}
            aria-label="Next page"
            onClick={() => onIndex(index + 1)}
          >
            <ChevronRight />
          </button>
          <p className="spread-count">
            {index + 1} / {journal.pageIds.length}
          </p>
          {deletePrompt && (
            <button
              className="delete-page-pill"
              aria-label="Delete this page"
              onClick={onDelete}
            >
              Delete Page
            </button>
          )}
        </>
      )}
      <div className={"pages-actions action-strip " + (grid ? "fixed" : "")}>
        {grid && (
          <button
            className="page-numbers-toggle"
            aria-label="Page numbers"
            aria-pressed={numbers}
            onClick={() => setNumbers((v) => !v)}
          >
            123
          </button>
        )}
        {grid && (
          <IconButton
            label={selecting ? "Cancel selection" : "Select pages"}
            name={
              selecting
                ? "shell-control-strip-exit-mode"
                : "shell-control-strip-multiselect-mode"
            }
            active={selecting}
            onClick={() => {
              setSelecting((s) => !s);
              setSelected([]);
            }}
          />
        )}
        {selecting ? (
          <>
            <IconButton
              label="Duplicate selected pages"
              name="shell-control-strip-duplicate"
              disabled={!selected.length}
              onClick={() => {
                onBatch(selected, "duplicate");
                setSelected([]);
                setSelecting(false);
              }}
            />
            <IconButton
              label="Move selected pages"
              name="shell-control-strip-move"
              disabled={!selected.length}
              onClick={() => onBatch(selected, "move")}
            />
            <IconButton
              label="Delete selected pages"
              name="shell-control-strip-delete"
              disabled={!selected.length}
              onClick={() => {
                onBatch(selected, "delete");
                setSelected([]);
                setSelecting(false);
              }}
            />
          </>
        ) : (
          <>
            <IconButton
              label="Page options"
              name="shell-control-strip-more-menu"
              onClick={onMenu}
              disabled={!page}
            />
            <IconButton
              label="Export page"
              name="shell-control-strip-share"
              onClick={onExport}
              disabled={!page}
            />
            <IconButton
              label="Delete page"
              name="shell-control-strip-delete"
              onClick={onDelete}
              disabled={!page}
            />
            <IconButton
              label="Add text note"
              name="shell-control-strip-text-note"
              onClick={onNote}
            />
            <IconButton
              label="New page"
              name="shell-control-strip-add-journal"
              onClick={onAdd}
            />
          </>
        )}
      </div>
    </section>
  );
}
