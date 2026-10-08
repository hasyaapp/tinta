import type { Page } from "@playwright/test";

const asset = (name: string) => "/art/" + name + ".svg";

const palettes = [
  ["#173d4a", "#ed5340", "#ffba3b", "#f9ebc4", "#6f9766", "#a8c6c1", "#ffffff"],
  ["#202932", "#4b6584", "#778ca3", "#a5b1c2", "#d1d8e0", "#eeeeee", "#ffffff"],
  ["#7f3a3b", "#c45c58", "#e29c87", "#efc7a4", "#a88261", "#65534a", "#ede2cf"],
  ["#36364b", "#6a547e", "#927aac", "#ba9bbb", "#d4b7bd", "#ecd1c8", "#fff2df"],
  ["#163f3b", "#327a6a", "#65a491", "#9fc2a4", "#d5db9b", "#e9bf56", "#f0e7cf"],
  ["#f5f3ed", "#f5f3ed", "#f5f3ed", "#f5f3ed", "#f5f3ed", "#f5f3ed", "#f5f3ed"],
  ["#f5f3ed", "#f5f3ed", "#f5f3ed", "#f5f3ed", "#f5f3ed", "#f5f3ed", "#f5f3ed"],
];

const journals = [
  {
    title: "Welcome",
    cover: "/art/covers-default-1.svg",
    band: "#139770",
    pages: 17,
  },
  {
    title: "Parity",
    cover: asset("covers-default-5"),
    band: "#e8b53a",
    pages: 15,
  },
  {
    title: "Teacher Planner",
    cover: asset("covers-default-6"),
    band: "#2f4a3e",
    pages: 12,
  },
  {
    title: "Drawing with Dots",
    cover: asset("covers-default-8"),
    band: "#c45458",
    pages: 14,
  },
  {
    title: "Robogee",
    cover: asset("covers-patterns-4"),
    band: "#e0b671",
    pages: 10,
  },
];

const selected = 1;

function fixture() {
  const pages: Record<string, Record<string, unknown>> = {};
  const model = journals.map((spec, j) => {
    const pageIds: string[] = [];
    for (let i = 0; i < spec.pages; i++) {
      const id = `j${j + 1}-p${i + 1}`;
      pages[id] = {
        id,
        width: 1376,
        height: 1032,
        ink: "",
        fill: "",
        background: "#f8f7f2",
        template: "",
        photos: [],
        note: "",
        thumbnail: "",
      };
      pageIds.push(id);
    }
    return {
      id: `j${j + 1}`,
      title: spec.title,
      cover: spec.cover,
      band: spec.band,
      pageIds,
      template: "",
      lastPage: spec.title === "Parity" ? 7 : 0,
    };
  });
  return {
    library: {
      version: 1,
      journals: model,
      palettes,
      clips: [],
      templates: [],
      settings: {
        fingerDraw: true,
        cleanCanvas: false,
        exportBackground: true,
        showGrid: false,
      },
      selected,
    },
    pages,
  };
}

/** Repeatable WEB fixture. It is not yet matched to the supplied iPad recordings. */
export async function seedFixture(page: Page) {
  await page.goto("/");
  await page.waitForFunction(
    () => document.querySelector(".save-state")?.textContent?.includes("Saved"),
    undefined,
    { timeout: 15000 },
  );
  await page.evaluate(
    async (data) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open("paper-web", 1);
        request.onupgradeneeded = () => {
          const d = request.result;
          if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
          if (!d.objectStoreNames.contains("pages"))
            d.createObjectStore("pages", { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["meta", "pages"], "readwrite");
        tx.objectStore("meta").put(data.library, "library");
        tx.objectStore("meta").put(1, "writeRevision");
        for (const p of Object.values(data.pages))
          tx.objectStore("pages").put(p);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    fixture() as unknown as { library: object; pages: Record<string, object> },
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector(".save-state")?.textContent?.includes("Saved"),
    undefined,
    { timeout: 15000 },
  );
}

export const FIXTURE_SELECTED = "Parity";
