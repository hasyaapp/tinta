import { openDB } from "idb";
import type { Library, Page } from "./model";
const connection = openDB("paper-web", 1, {
  upgrade(d) {
    d.createObjectStore("meta");
    d.createObjectStore("pages", { keyPath: "id" });
  },
});
let previous: Library | null = null;
let revision = 0;
let queue: Promise<void> = Promise.resolve();
export async function loadLibrary(): Promise<Library | null> {
  const d = await connection;
  const tx = d.transaction(["meta", "pages"], "readonly");
  const meta = await tx.objectStore("meta").get("library");
  revision = (await tx.objectStore("meta").get("writeRevision")) || 0;
  if (!meta) return null;
  const pages = Object.fromEntries(
    ((await tx.objectStore("pages").getAll()) as Page[]).map((p) => [p.id, p]),
  );
  const lib = { ...meta, pages } as Library;
  for (const j of lib.journals)
    if (j.pageIds.some((id) => !pages[id]))
      throw new Error(
        "Some pages could not be loaded. Your stored data has been kept.",
      );
  previous = lib;
  return lib;
}
export function saveLibrary(l: Library): Promise<void> {
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const d = await connection;
      const tx = d.transaction(["meta", "pages"], "readwrite");
      const actual = (await tx.objectStore("meta").get("writeRevision")) || 0;
      if (actual !== revision) {
        await tx.done;
        throw new Error(
          "Another tab changed these journals. Export this tab’s backup, then reload to use the latest saved version.",
        );
      }
      const { pages, ...meta } = l;
      tx.objectStore("meta").put(meta, "library");
      for (const [id, page] of Object.entries(pages))
        if (previous?.pages[id] !== page) tx.objectStore("pages").put(page);
      if (previous)
        for (const id of Object.keys(previous.pages))
          if (!pages[id]) tx.objectStore("pages").delete(id);
      tx.objectStore("meta").put(actual + 1, "writeRevision");
      await tx.done;
      revision = actual + 1;
      previous = l;
    });
  queue = operation;
  return operation;
}
