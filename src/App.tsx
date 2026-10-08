import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { Journal, Library, Page } from "./lib/model";
import {
  movePages,
  newJournal,
  newPage,
  pinHash,
  seedLibrary,
  uid,
  validateBackup,
} from "./lib/model";
import {
  duplicateJournalIn,
  duplicatePagesIn,
  insertJournal,
  insertPageAt,
  moveJournal,
  removeJournal,
  removePages,
  reorderPageIds,
} from "./lib/library";
import { loadLibrary, saveLibrary } from "./lib/storage";
import {
  composePage,
  download,
  exportPDF,
  fileImage,
  toBlob,
} from "./lib/images";
import { Home, Pages } from "./components/LibraryViews";
import { IconButton } from "./components/UI";
import DrawingCanvas from "./components/DrawingCanvas";
import PageCrumple from "./components/PageCrumple";
import JournalTransition, { COVER_DURATION } from "./components/JournalBook";
import JournalCustomizer from "./components/JournalCustomizer";
import SettingsDialog from "./components/dialogs/SettingsDialog";
import SearchDialog from "./components/dialogs/SearchDialog";
import HelpDialog from "./components/dialogs/HelpDialog";
import NoteDialog from "./components/dialogs/NoteDialog";
import MoveDialog from "./components/dialogs/MoveDialog";
import ExportDialog from "./components/dialogs/ExportDialog";
import JournalMenuDialog from "./components/dialogs/JournalMenuDialog";
import PageMenuDialog from "./components/dialogs/PageMenuDialog";
import PinDialog from "./components/dialogs/PinDialog";
import ConfirmDialog from "./components/dialogs/ConfirmDialog";

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

export default function App() {
  const [lib, setLib] = useState<Library | null>(null),
    [view, setView] = useState<View>("home"),
    [dialog, setDialog] = useState<Dialog>(null),
    [index, setIndex] = useState(0),
    [saved, setSaved] = useState("Loading journals…"),
    [error, setError] = useState(""),
    [fatal, setFatal] = useState(false),
    [busy, setBusy] = useState(false);
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
    update((l) => insertJournal(l, j, p));
    setIndex(0);
    setView("home");
    setDialog("customize");
  };
  const addPage = (open = false) => {
    if (!journal) return;
    const p = newPage(journal.template);
    const at = view === "grid" ? journal.pageIds.length : index + 1;
    update((l) => insertPageAt(l, journal.id, p, at));
    setIndex(Math.min(at, journal.pageIds.length));
    if (open) setView("canvas");
  };
  const deletePages = (ids: string[]) => {
    const apply = () => {
      setMeshPreparing(false);
      update((l) => removePages(l, ids));
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
    update((l) => duplicatePagesIn(l, journal.id, ids));
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
  const openFromList = (i: number) => {
    select(i);
    setView("home");
    setDialog(null);
  };
  const rotatePage = (p: Page) =>
    run(async () => {
      const c = await composePage(p, true, lib.templates);
      const rotated = document.createElement("canvas");
      rotated.width = c.height;
      rotated.height = c.width;
      const ctx = rotated.getContext("2d")!;
      ctx.translate(rotated.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(c, 0, 0);
      updatePage({
        ...p,
        width: rotated.width,
        height: rotated.height,
        ink: rotated.toDataURL(),
        fill: "",
        photos: [],
        template: "",
        thumbnail: "",
      });
      setDialog(null);
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
                  name="shell-journal-mode-on"
                  onClick={back}
                />
                <IconButton
                  label="Butterfly view"
                  name="shell-journal-mode-on"
                  active={view === "butterfly"}
                  onClick={() => setView("butterfly")}
                />
                <IconButton
                  label="Grid view"
                  name="shell-grid-mode-on"
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
              name="shell-journal-search"
              onClick={() => setDialog("search")}
            />
            <IconButton
              label="Settings"
              name="shell-settings"
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
                    update((l) => removeJournal(l, journal!.id));
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
            changeJournal((j) => reorderPageIds(j, from, to))
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
        <SettingsDialog
          settings={lib.settings}
          update={update}
          notify={notify}
          onBackup={backup}
          onRestoreClick={() => fileRef.current?.click()}
          onHelp={() => setDialog("help")}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "search" && (
        <SearchDialog
          journals={lib.journals}
          onOpen={openFromList}
          onMove={(i, dir) => update((l) => moveJournal(l, i, dir))}
          onClose={() => setDialog(null)}
        />
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
        <JournalMenuDialog
          journal={journal}
          onDuplicate={() => {
            update((l) => duplicateJournalIn(l, journal.id));
            setDialog(null);
            notify("Journal duplicated");
          }}
          onLock={() => setDialog("lock")}
          onExport={() => setDialog("export-journal")}
          onDelete={() =>
            setConfirm({
              title: "Delete this journal?",
              message:
                "All " +
                journal.pageIds.length +
                " pages in " +
                journal.title +
                " will be removed. This cannot be undone.",
              action: () => {
                update((l) => removeJournal(l, journal.id));
                setDialog(null);
                notify("Journal deleted");
              },
            })
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "page-menu" && page && (
        <PageMenuDialog
          page={page}
          pageNumber={index + 1}
          onDuplicate={() => duplicatePages([page.id])}
          onMove={() => batch([page.id], "move")}
          onNote={() => setDialog("note")}
          onRotate={() => rotatePage(page)}
          onDelete={() => deletePages([page.id])}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "move" && journal && (
        <MoveDialog
          journals={lib.journals.filter((j) => j.id !== journal.id)}
          onPick={(j) => {
            update((l) => movePages(l, moveIds, journal.id, j.id));
            setIndex(0);
            setDialog(null);
            setView("grid");
            notify("Pages moved to " + j.title);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "note" && page && (
        <NoteDialog
          page={page}
          onChange={updatePage}
          onClose={() => setDialog(null)}
        />
      )}
      {(dialog === "export-page" || dialog === "export-journal") && (
        <ExportDialog
          mode={dialog === "export-journal" ? "journal" : "page"}
          busy={busy}
          exportBackground={lib.settings.exportBackground}
          onExportBackground={(v) =>
            update((l) => ({
              ...l,
              settings: { ...l.settings, exportBackground: v },
            }))
          }
          onPNG={exportPNG}
          onPDF={() =>
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
          onClose={() => setDialog(null)}
        />
      )}
      {(dialog === "lock" || dialog === "unlock") && journal && (
        <PinDialog
          mode={dialog}
          locked={!!journal.lock}
          onSubmit={(pin, fail) =>
            run(async () => {
              if (journal.lock) {
                if (
                  (await pinHash(pin, journal.lock.salt)) !== journal.lock.hash
                ) {
                  fail("That code does not match. Try again.");
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
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "help" && <HelpDialog onClose={() => setDialog(null)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            confirm.action();
            setConfirm(null);
          }}
        />
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
