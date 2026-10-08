import type { Journal, Library, Page } from "./model";
import { duplicatePage, paletteDefaults, uid } from "./model";

export function insertJournal(l: Library, j: Journal, firstPage: Page): Library {
  const at = l.journals.length ? l.selected + 1 : 0;
  const journals = [...l.journals];
  journals.splice(at, 0, j);
  return {
    ...l,
    journals,
    pages: { ...l.pages, [firstPage.id]: firstPage },
    selected: at,
  };
}

export function insertPageAt(
  l: Library,
  journalId: string,
  p: Page,
  at: number,
): Library {
  return {
    ...l,
    pages: { ...l.pages, [p.id]: p },
    journals: l.journals.map((j) =>
      j.id === journalId
        ? {
            ...j,
            pageIds: [...j.pageIds.slice(0, at), p.id, ...j.pageIds.slice(at)],
            lastPage: at,
          }
        : j,
    ),
  };
}

// Quirk kept from the original inline reducer: lastPage resets to 0 on every
// journal, not just the ones losing pages.
export function removePages(l: Library, ids: string[]): Library {
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
}

export function duplicatePagesIn(
  l: Library,
  journalId: string,
  ids: string[],
): Library {
  const source = l.journals.find((j) => j.id === journalId);
  if (!source) return l;
  const pages = { ...l.pages },
    next: string[] = [];
  for (const id of source.pageIds) {
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
      j.id === journalId ? { ...j, pageIds: next } : j,
    ),
  };
}

export function reorderPageIds(j: Journal, from: string, to: string): Journal {
  if (from === to || !j.pageIds.includes(from) || !j.pageIds.includes(to))
    return j;
  const ids = j.pageIds.filter((id) => id !== from);
  ids.splice(ids.indexOf(to), 0, from);
  return { ...j, pageIds: ids };
}

export function removeJournal(l: Library, journalId: string): Library {
  const target = l.journals.find((j) => j.id === journalId);
  if (!target) return l;
  const pages = { ...l.pages };
  target.pageIds.forEach((id) => delete pages[id]);
  const journals = l.journals.filter((j) => j.id !== journalId);
  return {
    ...l,
    pages,
    journals,
    selected: Math.max(0, Math.min(l.selected, journals.length - 1)),
  };
}

export function duplicateJournalIn(l: Library, journalId: string): Library {
  const source = l.journals.find((j) => j.id === journalId);
  if (!source) return l;
  const copy = {
    ...structuredClone(source),
    id: uid(),
    title: source.title + " Copy",
    pageIds: [] as string[],
    lock: undefined,
  };
  const pages = { ...l.pages };
  for (const id of source.pageIds) {
    const p = duplicatePage(l.pages[id]);
    pages[p.id] = p;
    copy.pageIds.push(p.id);
  }
  const journals = [...l.journals];
  journals.splice(l.selected + 1, 0, copy);
  return { ...l, journals, pages, selected: l.selected + 1 };
}

export function moveJournal(l: Library, index: number, dir: -1 | 1): Library {
  const target = index + dir;
  if (target < 0 || target >= l.journals.length) return l;
  const journals = [...l.journals];
  [journals[target], journals[index]] = [journals[index], journals[target]];
  return {
    ...l,
    journals,
    selected: journals.findIndex((x) => x.id === l.journals[l.selected]?.id),
  };
}

export function resetDefaultPalettes(l: Library): Library {
  return {
    ...l,
    palettes: [
      ...paletteDefaults.slice(0, 5).map((p) => [...p]),
      ...l.palettes.slice(5),
    ],
  };
}
