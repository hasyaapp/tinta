import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileText,
  HelpCircle,
  ImagePlus,
  LockKeyhole,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Journal, Library, Page } from "./lib/model";
import {
  asset,
  coverNames,
  duplicatePage,
  movePages,
  newJournal,
  newPage,
  paletteDefaults,
  pinHash,
  seedLibrary,
  uid,
  validateBackup,
} from "./lib/model";
import { loadLibrary, saveLibrary } from "./lib/storage";
import {
  composePage,
  download,
  exportPDF,
  fileImage,
  toBlob,
} from "./lib/images";
import { Home, Pages } from "./components/LibraryViews";
import { Icon, IconButton, Modal, Toggle } from "./components/UI";
import DrawingCanvas from "./components/DrawingCanvas";
import PageCrumple from "./components/PageCrumple";
import JournalTransition, { COVER_DURATION } from "./components/JournalBook";
import JournalCustomizer from "./components/JournalCustomizer";

type View = "home" | "butterfly" | "grid" | "canvas";
type Dialog =
  | null
  | "settings"
  | "search"
  | "customize"
  | "journal-menu"
  | "page-menu"
  | "export-journal"
  | "export-page"
  | "note"
  | "move"
  | "help"
  | "lock"
  | "unlock";
// Row of the "Your Journals" sheet. Matches the native list: cover, title,
// page count, modified time, and the order controls. A trailing drag handle is
// not faked because reordering here is done with the two arrow buttons.
function JournalRow({
  journal,
  index,
  total,
  onOpen,
  onMove,
}: {
  journal: Journal;
  index: number;
  total: number;
  onOpen: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const pages = journal.pageIds.length;
  const minutes =
    typeof journal.updatedAt === "number"
      ? Math.max(0, Math.round((Date.now() - journal.updatedAt) / 60000))
      : null;
  return (
    <div className="journal-list-item">
      <button onClick={onOpen}>
        <img src={journal.cover} alt="" />
        <span>
          <strong>{journal.title}</strong>
          <small>
            {pages} {pages === 1 ? "Page" : "Pages"}
            {minutes !== null
              ? " / " + (minutes < 1 ? "1m" : minutes + "m")
              : ""}
          </small>
        </span>
      </button>
      <div className="reorder-buttons">
        <button
          aria-label={"Move " + journal.title + " up"}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          aria-label={"Move " + journal.title + " down"}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [lib, setLib] = useState<Library | null>(null),
    [view, setView] = useState<View>("home"),
    [dialog, setDialog] = useState<Dialog>(null),
    [index, setIndex] = useState(0),
    [saved, setSaved] = useState("Loading journals…"),
    [error, setError] = useState(""),
    [fatal, setFatal] = useState(false),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [pin, setPin] = useState(""),
    [pinError, setPinError] = useState("");
  const [confirm, setConfirm] = useState<{
      title: string;
      message: string;
      action: () => void;
    } | null>(null),
    [toast, setToast] = useState(""),
    [moveIds, setMoveIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null),
    coverRef = useRef<HTMLInputElement>(null);
  const revision = useRef(0),
    unlocked = useRef(new Set<string>()),
    afterUnlock = useRef<(() => void) | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);
  useEffect(() => {
    let live = true;
    loadLibrary()
      .then((l) => {
        if (live) setLib(l || seedLibrary());
      })
      .catch((e) => {
        if (live) {
          setError(String(e.message));
          setFatal(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!lib) return;
    const r = ++revision.current;
    setSaved("Saving…");
    saveLibrary(lib)
      .then(() => {
        if (r === revision.current) setSaved("Saved on this device");
      })
      .catch((e) => {
        setSaved("Not saved");
        setError(
          "Could not save your latest changes. Export a backup before closing Tinta. " +
            e.message,
        );
      });
  }, [lib]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  const update = useCallback(
    (fn: (l: Library) => Library) => setLib((l) => (l ? fn(l) : l)),
    [],
  );
  const updatePage = useCallback(
    (p: Page) =>
      update((l) => ({
        ...l,
        pages: { ...l.pages, [p.id]: p },
        journals: l.journals.map((j, i) =>
          i === l.selected && j.pageIds.includes(p.id)
            ? { ...j, updatedAt: Date.now() }
            : j,
        ),
      })),
    [update],
  );
  const journal = lib?.journals[lib.selected],
    page = journal && lib?.pages[journal.pageIds[index]];
  const changeJournal = (fn: (j: Journal) => Journal) =>
    update((l) => ({
      ...l,
      journals: l.journals.map((j, i) => {
        if (i !== l.selected) return j;
        const next = fn(j);
        return next === j ? j : { ...next, updatedAt: Date.now() };
      }),
    }));
  const select = (i: number) => {
    update((l) => ({
      ...l,
      selected: Math.max(0, Math.min(l.journals.length - 1, i)),
    }));
    setIndex(0);
  };
  const withAccess = (action: () => void) => {
    if (journal?.lock && !unlocked.current.has(journal.id)) {
      afterUnlock.current = action;
      setPin("");
      setPinError("");
      setDialog("unlock");
    } else action();
  };
  // Hardback cover swing, driven by a real 3D rotation about the spine. The
  // view only switches after the cover has opened, and reduced-motion users
  // skip straight to the destination.
  const coverTimer = useRef<number | null>(null);
  const [coverFlip, setCoverFlip] = useState<"open" | "close" | null>(null);
  const reducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const playCover = (kind: "open" | "close", commit: () => void) => {
    if (reducedMotion()) {
      commit();
      return;
    }
    if (coverTimer.current) window.clearTimeout(coverTimer.current);
    setCoverFlip(kind);
    coverTimer.current = window.setTimeout(() => {
      commit();
      setCoverFlip(null);
      coverTimer.current = null;
    }, COVER_DURATION);
  };
  useEffect(
    () => () => {
      if (coverTimer.current) window.clearTimeout(coverTimer.current);
    },
    [],
  );
  // Destructive animations: the page image (crumple) or the journal cover
  // (peel) is deformed by a WebGL mesh, then the action runs. If the mesh
  // cannot start, onDone fires and the action is unchanged.
  const meshDone = useRef<(() => void) | null>(null);
  const [meshPreparing, setMeshPreparing] = useState(false);
  const [meshAnim, setMeshAnim] = useState<{
    src: string;
    mode: "crumple" | "peel";
  } | null>(null);
  const playMesh = (
    src: string,
    mode: "crumple" | "peel",
    after: () => void,
  ) => {
    meshDone.current = after;
    setMeshAnim({ src, mode });
  };
  const finishMesh = useCallback(() => {
    setMeshAnim(null);
    const after = meshDone.current;
    meshDone.current = null;
    after?.();
  }, []);
  const openJournal = () =>
    withAccess(() => {
      if (!journal) return;
      setIndex(
        Math.min(journal.lastPage, Math.max(0, journal.pageIds.length - 1)),
      );
      playCover("open", () => setView("butterfly"));
    });
  const openPage = (id: string) => {
    if (!journal) return;
    const i = journal.pageIds.indexOf(id);
    setIndex(i);
    changeJournal((j) => ({ ...j, lastPage: i }));
    setView("canvas");
  };
  const back = () => {
    if (view === "canvas") {
      setView("butterfly");
      return;
    }
    if (view === "butterfly" && journal) {
      playCover("close", () => {
        changeJournal((j) => ({ ...j, lastPage: index }));
        setView("home");
      });
      return;
    }
    setView("home");
  };
  useEffect(() => {
    if (!lib) return;
    const key = (e: KeyboardEvent) => {
      if (
        dialog ||
        confirm ||
        coverFlip ||
        meshAnim ||
        meshPreparing ||
        e.defaultPrevented ||
        (e.target as HTMLElement).closest("input,textarea,[contenteditable]")
      )
        return;
      if (e.key === "Escape") {
        back();
      }
      if (view === "home") {
        if (e.key === "ArrowRight") select(lib.selected + 1);
        if (e.key === "ArrowLeft") select(lib.selected - 1);
        if (e.key === "Enter") openJournal();
      }
      if (view === "butterfly") {
        if (e.key === "ArrowRight")
          setIndex((i) => Math.min((journal?.pageIds.length || 1) - 1, i + 1));
        if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
        if (e.key === "Enter" && page) openPage(page.id);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const addJournal = () => {
    const j = newJournal();
    const p = newPage();
    j.pageIds = [p.id];
    update((l) => {
      const at = l.journals.length ? l.selected + 1 : 0;
      const journals = [...l.journals];
      journals.splice(at, 0, j);
      return { ...l, journals, pages: { ...l.pages, [p.id]: p }, selected: at };
    });
    setIndex(0);
    setView("home");
    setDialog("customize");
  };
  const addPage = (open = false) => {
    if (!journal) return;
    const p = newPage(journal.template);
    const at = view === "grid" ? journal.pageIds.length : index + 1;
    update((l) => ({
      ...l,
      pages: { ...l.pages, [p.id]: p },
      journals: l.journals.map((j) =>
        j.id === journal.id
          ? {
              ...j,
              pageIds: [
                ...j.pageIds.slice(0, at),
                p.id,
                ...j.pageIds.slice(at),
              ],
              lastPage: at,
            }
          : j,
      ),
    }));
    setIndex(Math.min(at, journal.pageIds.length));
    if (open) setView("canvas");
  };
  const deletePages = (ids: string[]) => {
    const apply = () => {
      setMeshPreparing(false);
      update((l) => {
        const pages = { ...l.pages };
        ids.forEach((id) => delete pages[id]);
        return {
          ...l,
          pages,
          journals: l.journals.map((j) => ({
            ...j,
            pageIds: j.pageIds.filter((id) => !ids.includes(id)),
            lastPage: 0,
          })),
        };
      });
      setIndex((i) =>
        Math.max(
          0,
          Math.min(i, (journal?.pageIds.length || 0) - ids.length - 1),
        ),
      );
      setDialog(null);
      if (view === "canvas") setView("butterfly");
      notify("Pages deleted");
    };
    setConfirm({
      title:
        ids.length === 1 ? "Delete page?" : "Delete " + ids.length + " pages?",
      message:
        "The selected pages and their notes will be removed from this journal.",
      action: () => {
        const only = ids.length === 1 ? lib?.pages[ids[0]] : undefined;
        if (!only || !lib || reducedMotion()) {
          apply();
          return;
        }
        setMeshPreparing(true);
        let preparationDeadline = 0;
        void Promise.race([
          composePage(only, lib.settings.exportBackground, lib.templates),
          new Promise<never>((_, reject) => {
            preparationDeadline = window.setTimeout(
              () => reject(new Error("Deletion preview timed out")),
              2000,
            );
          }),
        ])
          .then((c) => playMesh(c.toDataURL("image/png"), "crumple", apply))
          .catch(apply)
          .finally(() => window.clearTimeout(preparationDeadline));
      },
    });
  };
  const duplicatePages = (ids: string[]) => {
    if (!journal) return;
    update((l) => {
      const pages = { ...l.pages },
        next: string[] = [];
      for (const id of journal.pageIds) {
        next.push(id);
        if (ids.includes(id)) {
          const p = duplicatePage(l.pages[id]);
          pages[p.id] = p;
          next.push(p.id);
        }
      }
      return {
        ...l,
        pages,
        journals: l.journals.map((j) =>
          j.id === journal.id ? { ...j, pageIds: next } : j,
        ),
      };
    });
    setDialog(null);
    notify("Page duplicated");
  };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const exportPNG = () =>
    run(async () => {
      if (!page || !lib) return;
      const c = await composePage(
        page,
        lib.settings.exportBackground,
        lib.templates,
      );
      download(
        await toBlob(c),
        (journal?.title || "Tinta") + "-" + (index + 1) + ".png",
      );
      notify("Image exported");
    });
  const backup = () => {
    if (lib)
      download(
        new Blob([JSON.stringify(lib)], { type: "application/json" }),
        "Tinta-backup-" +
          new Date().toISOString().slice(0, 10) +
          ".tinta.json",
      );
  };
  const restore = async (file: File) => {
    try {
      if (file.size > 150 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 150 MB.");
      const data = validateBackup(JSON.parse(await file.text()));
      setConfirm({
        title: "Restore these journals?",
        message:
          "This replaces the journals currently on this device. Export a backup first if you want to keep them.",
        action: () => {
          unlocked.current.clear();
          setLib(data);
          setView("home");
          setDialog(null);
          setIndex(0);
          notify("Backup restored");
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid backup.");
    }
  };
  const batch = (ids: string[], action: string) => {
    if (action === "delete") deletePages(ids);
    if (action === "duplicate") duplicatePages(ids);
    if (action === "move") {
      setMoveIds(ids);
      setDialog("move");
    }
  };
  if (!lib)
    return (
      <main className="loading-screen">
        <div className="loading-mark">
          P<span>aper</span>
        </div>
        {fatal ? (
          <>
            <p>{error}</p>
            <button onClick={() => location.reload()}>Try again</button>
          </>
        ) : (
          <>
            <div className="loading-orbit" />
            <p>Opening your journals</p>
          </>
        )}
      </main>
    );
  const journalEntries = lib.journals.map((j, i) => ({ j, i }));
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? journalEntries.filter(({ j }) => j.title.toLowerCase().includes(needle))
    : journalEntries;
  const recent = needle
    ? []
    : [...journalEntries]
        .filter(({ j }) => typeof j.updatedAt === "number")
        .sort((a, b) => (b.j.updatedAt ?? 0) - (a.j.updatedAt ?? 0))
        .slice(0, 3);
  const openFromList = (i: number) => {
    select(i);
    setView("home");
    setDialog(null);
  };
  const moveJournal = (i: number, dir: -1 | 1) =>
    update((l) => {
      const target = i + dir;
      if (target < 0 || target >= l.journals.length) return l;
      const journals = [...l.journals];
      [journals[target], journals[i]] = [journals[i], journals[target]];
      return {
        ...l,
        journals,
        selected: journals.findIndex(
          (x) => x.id === l.journals[l.selected]?.id,
        ),
      };
    });
  return (
    <main
      inert={!!coverFlip || !!meshAnim || meshPreparing}
      aria-busy={!!coverFlip || !!meshAnim || meshPreparing}
      className={
        "paper-app view-" +
        view +
        (dialog === "customize" ? " is-customizing" : "") +
        (coverFlip ? " is-book-transition transition-" + coverFlip : "")
      }
    >
      {view !== "canvas" && (
        <header className="app-header">
          <div className="header-left">
            {view !== "home" && (
              <>
                <IconButton
                  label="Back to journals"
                  name="Shell/journal-mode-on"
                  onClick={back}
                />
                <IconButton
                  label="Butterfly view"
                  name="Shell/journal-mode-on"
                  active={view === "butterfly"}
                  onClick={() => setView("butterfly")}
                />
                <IconButton
                  label="Grid view"
                  name="Shell/grid-mode-on"
                  active={view === "grid"}
                  onClick={() => setView("grid")}
                />
              </>
            )}
          </div>
          <div className="header-right">
            <span
              className={
                "save-state " + (saved === "Not saved" ? "failed" : "")
              }
              title={saved}
            >
              <Check size={13} />
              <span>{saved}</span>
            </span>
            <IconButton
              label="Search journals"
              name="Shell/journal-search"
              onClick={() => {
                setQuery("");
                setDialog("search");
              }}
            />
            <IconButton
              label="Settings"
              name="Shell/settings"
              onClick={() => setDialog("settings")}
            />
          </div>
        </header>
      )}
      {view === "home" && (
        <Home
          library={lib}
          shelfState={`${coverFlip ?? ""}:${dialog === "customize"}`}
          onSelect={select}
          onOpen={openJournal}
          onAdd={addJournal}
          onEdit={() => withAccess(() => setDialog("customize"))}
          onDelete={() =>
            withAccess(() => {
              setConfirm({
                title: "Delete this journal?",
                message:
                  "All pages in this journal will be removed. This cannot be undone.",
                action: () => {
                  const remove = () =>
                    update((l) => {
                      const pages = { ...l.pages };
                      journal!.pageIds.forEach((id) => delete pages[id]);
                      const journals = l.journals.filter(
                        (j) => j.id !== journal!.id,
                      );
                      return {
                        ...l,
                        pages,
                        journals,
                        selected: Math.max(
                          0,
                          Math.min(l.selected, journals.length - 1),
                        ),
                      };
                    });
                  if (reducedMotion() || !journal) {
                    remove();
                    return;
                  }
                  playMesh(journal.cover, "peel", remove);
                },
              });
            })
          }
          onMenu={() => withAccess(() => setDialog("journal-menu"))}
          onExport={() => withAccess(() => setDialog("export-journal"))}
        />
      )}
      {(view === "butterfly" || view === "grid") && journal && (
        <Pages
          key={view + journal.id}
          library={lib}
          grid={view === "grid"}
          index={index}
          onIndex={setIndex}
          onOpen={openPage}
          onAdd={() => addPage()}
          onMenu={() => setDialog("page-menu")}
          onExport={() => setDialog("export-page")}
          onDelete={() => page && deletePages([page.id])}
          onNote={() => {
            if (!page) addPage();
            setDialog("note");
          }}
          onReorder={(from, to) =>
            changeJournal((j) => {
              if (
                from === to ||
                !j.pageIds.includes(from) ||
                !j.pageIds.includes(to)
              )
                return j;
              const ids = j.pageIds.filter((id) => id !== from);
              ids.splice(ids.indexOf(to), 0, from);
              return { ...j, pageIds: ids };
            })
          }
          onBatch={batch}
        />
      )}
      {view === "canvas" && page && (
        <DrawingCanvas
          key={page.id + "-" + page.width + "-" + page.height}
          page={page}
          library={lib}
          onChange={updatePage}
          onLibraryChange={update}
          onClose={() => setView("butterfly")}
          onSettings={() => setDialog("settings")}
          onNote={() => setDialog("note")}
          onExport={() => setDialog("export-page")}
          onNavigate={(delta) => {
            const n = index + delta;
            if (n >= 0 && n < journal!.pageIds.length) setIndex(n);
          }}
          onNewPage={() => addPage(true)}
          notify={notify}
        />
      )}
      {dialog === "settings" && (
        <Modal title="Settings" onClose={() => setDialog(null)}>
          <section className="settings-section">
            <span className="section-label">CANVAS</span>
            {(
              [
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
              ] as const
            ).map(([key, label, detail]) => (
              <Toggle
                key={key}
                label={label}
                detail={detail}
                value={lib.settings[key]}
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
                update((l) => ({
                  ...l,
                  palettes: [
                    ...paletteDefaults.slice(0, 5).map((p) => [...p]),
                    ...l.palettes.slice(5),
                  ],
                }));
                notify("Default palettes restored");
              }}
            >
              <Icon name="Canvas/Tray/add-palette" />
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
            <button className="menu-row" onClick={backup}>
              <Download size={19} />
              <span>
                Export a backup
                <small>All journals, drawings, notes, and palettes</small>
              </span>
            </button>
            <button
              className="menu-row"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={19} />
              <span>Restore a backup</span>
            </button>
            <button className="menu-row" onClick={() => setDialog("help")}>
              <HelpCircle size={19} />
              <span>How to use Tinta</span>
            </button>
          </section>
          <p className="settings-footnote">
            Your work stays on this device. Keep a backup of the things you
            love.
          </p>
        </Modal>
      )}
      {dialog === "search" && (
        <Modal title="Your Journals" onClose={() => setDialog(null)}>
          <div className="search-field">
            <Search size={19} />
            <input
              autoFocus
              placeholder="Title Search"
              aria-label="Search journals by title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="journal-list">
            {!needle && recent.length > 0 && (
              <>
                <h3 className="journal-list-group">Last Edited</h3>
                {recent.map(({ j, i }) => (
                  <JournalRow
                    key={j.id}
                    journal={j}
                    index={i}
                    total={lib.journals.length}
                    onOpen={() => openFromList(i)}
                    onMove={(dir) => moveJournal(i, dir)}
                  />
                ))}
              </>
            )}
            <h3 className="journal-list-group">
              Local ({lib.journals.length})
            </h3>
            {matches.length === 0 && (
              <p className="journal-list-empty">
                No journal matches that title.
              </p>
            )}
            {matches.map(({ j, i }) => (
              <JournalRow
                key={j.id}
                journal={j}
                index={i}
                total={lib.journals.length}
                onOpen={() => openFromList(i)}
                onMove={(dir) => moveJournal(i, dir)}
              />
            ))}
          </div>
        </Modal>
      )}
      {dialog === "customize" && journal && (
        <JournalCustomizer
          journal={journal}
          library={lib}
          onChange={(j) => changeJournal(() => j)}
          onPhoto={() => coverRef.current?.click()}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "journal-menu" && journal && (
        <Modal title={journal.title} onClose={() => setDialog(null)}>
          <button
            className="menu-row"
            onClick={() => {
              update((l) => {
                const j = {
                  ...structuredClone(journal),
                  id: uid(),
                  title: journal.title + " Copy",
                  pageIds: [] as string[],
                  lock: undefined,
                };
                const pages = { ...l.pages };
                for (const id of journal.pageIds) {
                  const p = duplicatePage(l.pages[id]);
                  pages[p.id] = p;
                  j.pageIds.push(p.id);
                }
                const journals = [...l.journals];
                journals.splice(l.selected + 1, 0, j);
                return { ...l, journals, pages, selected: l.selected + 1 };
              });
              setDialog(null);
              notify("Journal duplicated");
            }}
          >
            <Icon name="Shell/Control Strip/duplicate" />
            <span>Duplicate journal</span>
          </button>
          <button
            className="menu-row"
            onClick={() => {
              setPin("");
              setPinError("");
              setDialog("lock");
            }}
          >
            <LockKeyhole size={20} />
            <span>{journal.lock ? "Remove lock" : "Add lock"}</span>
          </button>
          <button
            className="menu-row"
            onClick={() => setDialog("export-journal")}
          >
            <Icon name="Shell/Control Strip/share" />
            <span>Export journal</span>
          </button>
          <button
            className="menu-row danger"
            onClick={() =>
              setConfirm({
                title: "Delete this journal?",
                message:
                  "All " +
                  journal.pageIds.length +
                  " pages in " +
                  journal.title +
                  " will be removed. This cannot be undone.",
                action: () => {
                  update((l) => {
                    const pages = { ...l.pages };
                    journal.pageIds.forEach((id) => delete pages[id]);
                    const journals = l.journals.filter(
                      (j) => j.id !== journal.id,
                    );
                    return {
                      ...l,
                      journals,
                      pages,
                      selected: Math.max(
                        0,
                        Math.min(l.selected, journals.length - 1),
                      ),
                    };
                  });
                  setDialog(null);
                  notify("Journal deleted");
                },
              })
            }
          >
            <Trash2 size={20} />
            <span>Delete journal</span>
          </button>
        </Modal>
      )}
      {dialog === "page-menu" && page && (
        <Modal title={"Page " + (index + 1)} onClose={() => setDialog(null)}>
          <button
            className="menu-row"
            onClick={() => duplicatePages([page.id])}
          >
            <Icon name="Shell/Control Strip/duplicate" />
            <span>Duplicate page</span>
          </button>
          <button className="menu-row" onClick={() => batch([page.id], "move")}>
            <Icon name="Shell/Control Strip/move" />
            <span>Move to another journal</span>
          </button>
          <button className="menu-row" onClick={() => setDialog("note")}>
            <FileText size={20} />
            <span>{page.note ? "Edit note" : "Add a text note"}</span>
          </button>
          <button
            className="menu-row"
            onClick={() =>
              run(async () => {
                const c = await composePage(page, true, lib.templates);
                const rotated = document.createElement("canvas");
                rotated.width = c.height;
                rotated.height = c.width;
                const ctx = rotated.getContext("2d")!;
                ctx.translate(rotated.width, 0);
                ctx.rotate(Math.PI / 2);
                ctx.drawImage(c, 0, 0);
                updatePage({
                  ...page,
                  width: rotated.width,
                  height: rotated.height,
                  ink: rotated.toDataURL(),
                  fill: "",
                  photos: [],
                  template: "",
                  thumbnail: "",
                });
                setDialog(null);
              })
            }
          >
            <Icon name="Shell/Control Strip/rotate" />
            <span>Rotate page</span>
          </button>
          <button
            className="menu-row danger"
            onClick={() => deletePages([page.id])}
          >
            <Trash2 size={20} />
            <span>Delete page</span>
          </button>
        </Modal>
      )}
      {dialog === "move" && journal && (
        <Modal title="Move to journal" onClose={() => setDialog(null)}>
          {lib.journals
            .filter((j) => j.id !== journal.id)
            .map((j) => (
              <button
                key={j.id}
                className="menu-row"
                onClick={() => {
                  update((l) => movePages(l, moveIds, journal.id, j.id));
                  setIndex(0);
                  setDialog(null);
                  setView("grid");
                  notify("Pages moved to " + j.title);
                }}
              >
                <img className="mini-cover" src={j.cover} alt="" />
                <span>{j.title}</span>
              </button>
            ))}
        </Modal>
      )}
      {dialog === "note" && page && (
        <Modal title="A note for this page" onClose={() => setDialog(null)}>
          <div className="note-tools">
            <button
              onClick={() => updatePage({ ...page, note: page.note + "\n• " })}
            >
              • List
            </button>
            <button
              onClick={() => updatePage({ ...page, note: page.note + "\n☐ " })}
            >
              ☐ Checklist
            </button>
            <button
              className="danger"
              onClick={() => updatePage({ ...page, note: "" })}
            >
              Clear
            </button>
          </div>
          <textarea
            className="note-editor"
            aria-label="Page note"
            placeholder="Put your thoughts into words…"
            value={page.note}
            onChange={(e) => updatePage({ ...page, note: e.target.value })}
          />
          <button className="primary-button" onClick={() => setDialog(null)}>
            Done
          </button>
        </Modal>
      )}
      {(dialog === "export-page" || dialog === "export-journal") && (
        <Modal
          title={
            dialog === "export-journal"
              ? "Share your journal"
              : "Share your idea"
          }
          onClose={() => setDialog(null)}
        >
          <div className="export-options">
            {dialog === "export-page" && (
              <button disabled={busy} onClick={exportPNG}>
                <ImagePlus size={28} />
                <strong>PNG image</strong>
                <span>A picture of this page</span>
              </button>
            )}
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await exportPDF(
                    dialog === "export-page" && page
                      ? [page]
                      : journal!.pageIds.map((id) => lib.pages[id]),
                    journal?.title || "Tinta",
                    lib.settings.exportBackground,
                    lib.templates,
                  );
                  notify("PDF exported");
                })
              }
            >
              <FileText size={28} />
              <strong>PDF document</strong>
              <span>
                {dialog === "export-page"
                  ? "This page"
                  : "Every idea, in order"}
              </span>
            </button>
          </div>
          <Toggle
            label="Include background color"
            value={lib.settings.exportBackground}
            onChange={(v) =>
              update((l) => ({
                ...l,
                settings: { ...l.settings, exportBackground: v },
              }))
            }
          />
          {busy && <p className="muted">Preparing your export…</p>}
        </Modal>
      )}
      {(dialog === "lock" || dialog === "unlock") && journal && (
        <Modal
          title={
            dialog === "unlock"
              ? "This journal is private"
              : journal.lock
                ? "Remove journal lock"
                : "A little more privacy"
          }
          onClose={() => setDialog(null)}
        >
          <p className="muted">
            {dialog === "unlock" || journal.lock
              ? "Enter your four-digit code."
              : "Choose a four-digit code to hide this journal on a shared device. This locks the app view; it does not encrypt a backup."}
          </p>
          <input
            className="pin-input"
            aria-label="Journal PIN"
            inputMode="numeric"
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
          {pinError && <p className="danger">{pinError}</p>}
          <button
            className="primary-button"
            disabled={pin.length !== 4}
            onClick={() =>
              run(async () => {
                if (journal.lock) {
                  if (
                    (await pinHash(pin, journal.lock.salt)) !==
                    journal.lock.hash
                  ) {
                    setPinError("That code does not match. Try again.");
                    return;
                  }
                  if (dialog === "unlock") {
                    unlocked.current.add(journal.id);
                    setDialog(null);
                    afterUnlock.current?.();
                    afterUnlock.current = null;
                    return;
                  } else changeJournal((j) => ({ ...j, lock: undefined }));
                } else {
                  const salt = uid(),
                    hash = await pinHash(pin, salt);
                  changeJournal((j) => ({ ...j, lock: { salt, hash } }));
                  unlocked.current.delete(journal.id);
                }
                setDialog(null);
              })
            }
          >
            {dialog === "unlock"
              ? "Open journal"
              : journal.lock
                ? "Remove lock"
                : "Set code"}
          </button>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal title="Think with your hands" onClose={() => setDialog(null)}>
          <div className="help-list">
            <p>
              <strong>Make a mark.</strong> Pick a tool in the tray. Tap the
              selected tool to change its size. Use a Pencil, your finger, or a
              mouse.
            </p>
            <p>
              <strong>Find your way.</strong> Tap a journal, then a page. Pinch
              to zoom. Swipe from the canvas edges to turn a page.
            </p>
            <p>
              <strong>Try again.</strong> Undo with the arrow, a two-finger
              double tap, or ⌘Z. Shift-⌘Z brings it back.
            </p>
            <p>
              <strong>Move things around.</strong> Draw around ink with Cut.
              Move, resize, rotate, duplicate, or keep the selection as a clip.
            </p>
            <p>
              <strong>Add some color.</strong> Tap a swatch twice to edit it.
              Drag a swatch onto the page to change its background.
            </p>
            <p>
              <strong>Keep your ideas.</strong> Your work saves on this device.
              Export a backup from Settings to take your journals with you.
            </p>
          </div>
          <p className="settings-footnote">
            Tinta · Reference version 5.5.10
            <br />
            Build{" "}
            {document
              .querySelector('meta[name="paper-build"]')
              ?.getAttribute("content") || "dev"}
            <br />
            Native cloud and subscription services are not connected.
          </p>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p>{confirm.message}</p>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className="primary-button danger-button"
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
      {error && !fatal && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={18} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      <input
        hidden
        ref={fileRef}
        type="file"
        accept=".json,.paper-web.json"
        onChange={(e) => {
          if (e.target.files?.[0]) void restore(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={coverRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run(async () => {
              const im = await fileImage(file);
              changeJournal((j) => ({ ...j, cover: im.src }));
            });
          e.target.value = "";
        }}
      />
      {meshAnim && (
        <PageCrumple
          src={meshAnim.src}
          mode={meshAnim.mode}
          onDone={finishMesh}
        />
      )}
      {coverFlip && journal && (
        <JournalTransition
          kind={coverFlip}
          journal={journal}
          page={page}
          templates={lib.templates}
        />
      )}
    </main>
  );
}
