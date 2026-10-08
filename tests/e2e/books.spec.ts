import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { seedFixture } from "./fixture";
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test("journal lift, close and re-open retain the selected book and page through interrupted input", async ({
  page,
}) => {
  await seedFixture(page);
  const book = button(page, "Open Parity");
  const before = await book.boundingBox();
  // Bounding geometry estimated from the settled native frame, not pixel parity.
  expect(before!.width).toBeGreaterThan(340);
  expect(before!.width).toBeLessThan(360);
  expect(before!.y).toBeGreaterThan(260);
  expect(before!.y).toBeLessThan(282);
  const adjacent = await button(page, "Select Welcome").boundingBox();
  expect(before!.x - (adjacent!.x + adjacent!.width)).toBeGreaterThan(28);
  expect(before!.x - (adjacent!.x + adjacent!.width)).toBeLessThan(55);
  await book.click();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "Journal pages", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".spread-page.current")).toHaveAttribute(
    "aria-label",
    "Open page 8",
  );
  await button(page, "Back to journals").click();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("ArrowRight");
  await expect(book).toBeVisible();
  await expect(page.locator(".cover-flip")).toHaveCount(0);
  const after = await book.boundingBox();
  expect(after!.x).toBeCloseTo(before!.x, 0);
  expect(after!.y).toBeCloseTo(before!.y, 0);
  await book.click();
  await expect(page.locator(".spread-page.current")).toHaveAttribute(
    "aria-label",
    "Open page 8",
  );
  await expect(page.locator(".cover-flip")).toHaveCount(0);
});

async function coloredPages(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("paper-web");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["meta", "pages"], "readwrite");
    const read = (r: IDBRequest) =>
      new Promise<any>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const library = await read(tx.objectStore("meta").get("library"));
    const journal = library.journals[library.selected];
    for (const [i, colors] of [
      [7, ["#ff0000", "#0000ff"]],
      [8, ["#00ff00", "#ff8800"]],
    ] as const) {
      const p = await read(tx.objectStore("pages").get(journal.pageIds[i]));
      const c = document.createElement("canvas");
      c.width = p.width;
      c.height = p.height;
      const g = c.getContext("2d")!;
      g.fillStyle = colors[0];
      g.fillRect(0, 0, c.width / 2, c.height);
      g.fillStyle = colors[1];
      g.fillRect(c.width / 2, 0, c.width / 2, c.height);
      tx.objectStore("pages").put({ ...p, ink: c.toDataURL(), thumbnail: "" });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
}
async function leafPixels(page: Page) {
  const box = await page.locator(".spread-page.current").boundingBox();
  const shot = PNG.sync.read(await page.screenshot({ scale: "css" }));
  const at = (fraction: number) => {
    const x = Math.floor(box!.x + box!.width * fraction),
      y = Math.floor(box!.y + box!.height / 2);
    return Array.from(
      shot.data.subarray(
        (y * shot.width + x) * 4,
        (y * shot.width + x) * 4 + 3,
      ),
    );
  };
  return [at(0.25), at(0.75)];
}

test("two-sided page flip keeps left/right artwork intact in both directions and survives rapid navigation", async ({
  page,
}) => {
  await seedFixture(page);
  await coloredPages(page);
  await button(page, "Open Parity").click();
  await expect(page.locator(".cover-flip")).toHaveCount(0);
  let pixels = await leafPixels(page);
  expect(pixels[0][0]).toBeGreaterThan(190);
  expect(pixels[0][2]).toBeLessThan(30);
  expect(pixels[1][2]).toBeGreaterThan(190);
  expect(pixels[1][0]).toBeLessThan(30);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".page-turn-scene")).toBeVisible();
  // The sheet covers the outgoing left page as it lands, so that page has to stay
  // put for the whole turn instead of being swapped out at the half-way point.
  await page.waitForTimeout(650);
  await expect(page.locator(".turn-stationary")).toBeVisible();
  await expect(page.locator(".page-turn-scene")).toHaveCount(0);
  pixels = await leafPixels(page);
  expect(pixels[0][1]).toBeGreaterThan(190);
  expect(pixels[0][0]).toBeLessThan(30);
  expect(pixels[1][0]).toBeGreaterThan(190);
  expect(pixels[1][1]).toBeGreaterThan(80);
  await page.keyboard.press("ArrowLeft");
  // Wait for the backward turn to mount before waiting for it to finish: the
  // absence assertion alone can pass in the gap before React mounts the scene.
  await expect(page.locator(".page-turn-scene")).toBeVisible();
  await expect(page.locator(".page-turn-scene")).toHaveCount(0);
  pixels = await leafPixels(page);
  expect(pixels[0][0]).toBeGreaterThan(190);
  expect(pixels[1][2]).toBeGreaterThan(190);
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".spread-page.current")).toHaveAttribute(
    "aria-label",
    "Open page 13",
  );
  await expect(page.locator(".page-turn-scene")).toHaveCount(0);
  await button(page, "Open page 13").click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
});

test("reduced motion opens without animation and the book remains usable after portrait resize", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedFixture(page);
  await button(page, "Open Parity").click();
  await expect(page.locator(".cover-flip")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Journal pages", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".page-turn-scene")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const book = await page.locator(".spread-page.current").boundingBox();
  expect(book!.width).toBeLessThan(390);
  expect(book!.y).toBeGreaterThan(100);
  await button(page, "Back to journals").click();
  await expect(button(page, "Open Parity")).toBeVisible();
  const cover = await button(page, "Open Parity").boundingBox();
  expect(cover!.x).toBeGreaterThan(0);
  expect(cover!.x + cover!.width).toBeLessThan(390);
  await button(page, "Open Parity").click();
  await button(page, "Open page 9").click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
});

async function shelfAlignment(page: Page) {
  return page.locator(".book-position").evaluateAll((nodes) => {
    const canvas = document.querySelector(
      ".shelf-canvas",
    ) as HTMLCanvasElement & {
      shelfEngine: {
        projectedRect(e: Element): {
          x: number;
          y: number;
          w: number;
          h: number;
        };
      };
    };
    return Math.max(
      ...nodes.map((node) => {
        const actual = node.getBoundingClientRect(),
          painted = canvas.shelfEngine.projectedRect(node);
        return Math.max(
          Math.abs(actual.x - painted.x),
          Math.abs(actual.y - painted.y),
          Math.abs(actual.width - painted.w),
          Math.abs(actual.height - painted.h),
        );
      }),
    );
  });
}

test("painted shelf follows journal selection, customization, resize and opening", async ({
  page,
}) => {
  await seedFixture(page);
  await expect(page.locator("[data-shelf-painted]")).toHaveCount(5);
  await expect.poll(() => shelfAlignment(page)).toBeLessThan(1);
  // Assert painted pixels too: DOM geometry alone passed when every cover was black.
  const shot = PNG.sync.read(await page.screenshot({ scale: "css" }));
  const pixel = Array.from(
    shot.data.subarray(
      (400 * shot.width + 600) * 4,
      (400 * shot.width + 600) * 4 + 3,
    ),
  );
  // Fixture "Parity" cover is covers-default-5 (#c89b9b); allow for shelf lighting.
  expect(pixel[0]).toBeGreaterThan(175);
  expect(pixel[0]).toBeLessThan(225);
  expect(pixel[1]).toBeGreaterThan(130);
  expect(pixel[1]).toBeLessThan(180);
  expect(pixel[2]).toBeGreaterThan(130);
  expect(pixel[2]).toBeLessThan(180);
  const actions = await page.locator(".home-actions").boundingBox();
  expect(actions!.y + actions!.height / 2).toBeCloseTo(899, 0);
  await button(page, "Select Welcome").click();
  await expect(button(page, "Open Welcome")).toBeVisible();
  await page.waitForTimeout(750);
  await expect.poll(() => shelfAlignment(page)).toBeLessThan(1);
  await button(page, "Customize journal").click();
  await page.waitForTimeout(750);
  await expect.poll(() => shelfAlignment(page)).toBeLessThan(1);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1032, height: 1376 });
  await page.waitForTimeout(750);
  await expect.poll(() => shelfAlignment(page)).toBeLessThan(1);
  await button(page, "Open Welcome").click();
  // Opening has one moving cover; the shelf must not leave a second cover behind.
  await expect(page.locator(".cover-flip")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".shelf-canvas")
        .evaluate(
          (canvas: any) =>
            canvas.shelfEngine.books.find((b: any) =>
              b.element.classList.contains("selected"),
            ).group.visible,
        ),
    )
    .toBe(false);
  await expect(page.locator(".cover-flip")).toHaveCount(0);
});

test("losing the shelf graphics context restores visible CSS books and navigation", async ({
  page,
}) => {
  await seedFixture(page);
  await expect(page.locator("[data-shelf-painted]")).toHaveCount(5);
  await page.locator(".shelf-canvas").evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext("webgl2")!;
    gl.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.locator(".shelf-canvas")).toHaveCount(0);
  await expect(page.locator("[data-shelf-painted]")).toHaveCount(0);
  await expect(page.locator(".selected .book-cover")).toBeVisible();
  await button(page, "Select Welcome").click();
  await button(page, "Open Welcome").click();
  await expect(
    page.getByRole("region", { name: "Journal pages", exact: true }),
  ).toBeVisible();
});
