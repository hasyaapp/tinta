import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { test, expect, type Page } from "@playwright/test";
const SCREENSHOTS = process.env.SCREENSHOT_OUT || "artifacts";
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
async function blank(page: Page, title = "Test journal") {
  await page.goto("/");
  await button(page, "New journal").click();
  await page.getByRole("textbox", { name: "Journal name" }).fill(title);
  await button(page, "Close dialog").click();
  await button(page, "Open " + title).click();
  await button(page, "Open page 1").click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
}
async function path(page: Page, points: number[][]) {
  await page.mouse.move(points[0][0], points[0][1]);
  await page.mouse.down();
  for (const p of points.slice(1))
    await page.mouse.move(p[0], p[1], { steps: 8 });
  await page.mouse.up();
}
async function ink(page: Page) {
  return page
    .locator(".paper-surface canvas")
    .nth(1)
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
}
async function inkCount(page: Page) {
  return page
    .locator(".paper-surface canvas")
    .nth(1)
    .evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) count++;
      return count;
    });
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("paper-web");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["meta", "pages"]);
    const read = (r: IDBRequest) =>
      new Promise<any>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const [meta, pages] = await Promise.all([
      read(tx.objectStore("meta").get("library")),
      read(tx.objectStore("pages").getAll()),
    ]);
    db.close();
    return { ...meta, pages };
  });
}

test("native assets render without missing resources on iPad and phone", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  await page.goto("/");
  await button(page, "Open Design Project").click();
  await button(page, "Open page 1").click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((els) =>
          els.every((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${SCREENSHOTS}/canvas-ipad.png`,
  });
  await button(page, "Templates").click();
  await expect(
    page.getByRole("region", { name: "Canvas templates" }),
  ).toBeVisible();
  await button(page, "Close templates").click();
  await button(page, "Close canvas").click();
  await button(page, "Grid view").click();
  await page.screenshot({
    animations: "disabled",
    path: `${SCREENSHOTS}/grid-ipad.png`,
  });
  await button(page, "Back to journals").click();
  await page.screenshot({
    animations: "disabled",
    path: `${SCREENSHOTS}/home-ipad.png`,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    animations: "disabled",
    path: `${SCREENSHOTS}/home-phone.png`,
  });
  await button(page, "Open Design Project").click();
  await button(page, "Open page 1").click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
  await page.screenshot({
    animations: "disabled",
    path: `${SCREENSHOTS}/canvas-phone.png`,
  });
  await expect(button(page, "Undo")).toBeVisible();
  await expect(button(page, "Redo")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  expect(errors).toEqual([]);
});
test("draw, undo, redo, autosave, reopen and PNG/PDF export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await blank(page);
  const empty = await ink(page);
  await path(page, [
    [240, 260],
    [400, 370],
    [540, 230],
    [700, 400],
  ]);
  await expect.poll(() => inkCount(page)).toBeGreaterThan(200);
  const drawn = await ink(page);
  expect(drawn).not.toBe(empty);
  await button(page, "Undo").click();
  await expect.poll(() => ink(page)).toBe(empty);
  await button(page, "Redo").click();
  await expect.poll(() => ink(page)).toBe(drawn);
  await button(page, "Add a note").click();
  await page
    .getByRole("textbox", { name: "Page note" })
    .fill("Ideas worth keeping\n☐ Sketch the garden");
  await button(page, "Done").click();
  await button(page, "Export drawing").click();
  const png = page.waitForEvent("download");
  await button(page, "PNG image A picture of this page").click();
  const pngFile = await png;
  expect(pngFile.suggestedFilename()).toMatch(/\.png$/);
  const bytes = await readFile((await pngFile.path())!);
  expect(bytes.readUInt32BE(16)).toBe(1376);
  expect(bytes.readUInt32BE(20)).toBe(1032);
  const pdf = page.waitForEvent("download");
  await button(page, "PDF document This page").click();
  const pdfFile = await pdf;
  expect(pdfFile.suggestedFilename()).toMatch(/\.pdf$/);
  const doc = await PDFDocument.load(await readFile((await pdfFile.path())!));
  expect(doc.getPageCount()).toBe(2);
  await button(page, "Close dialog").click();
  await expect
    .poll(async () => {
      const l = await stored(page);
      const j = l.journals[l.selected];
      return l.pages.find((p: any) => p.id === j.pageIds[0]).note;
    })
    .toContain("garden");
  await page.reload();
  await button(page, "Open Test journal").click();
  await button(page, "Open page 1").click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
  await expect.poll(() => ink(page)).toBe(drawn);
  expect(errors).toEqual([]);
});
test("all brush profiles, eraser and blend produce real image changes", async ({
  page,
}) => {
  await blank(page);
  for (const [i, tool] of [
    "Fountain Pen",
    "Pencil",
    "Marker",
    "Felt Pen",
    "Watercolor",
  ].entries()) {
    await button(page, tool).click();
    const before = await ink(page);
    await path(page, [
      [220, 220 + i * 80],
      [420, 240 + i * 80],
      [600, 215 + i * 80],
    ]);
    await expect.poll(() => ink(page), tool).not.toBe(before);
  }
  const count = await inkCount(page);
  await button(page, "Eraser").click();
  await path(page, [
    [410, 180],
    [410, 620],
  ]);
  await expect.poll(() => inkCount(page)).toBeLessThan(count);
  const before = await ink(page);
  await button(page, "Blend").click();
  await path(page, [
    [290, 200],
    [290, 400],
    [390, 420],
  ]);
  await expect.poll(() => ink(page)).not.toBe(before);
  await page.screenshot({
    animations: "disabled",
    path: `${SCREENSHOTS}/brushes-ipad.png`,
  });
});
test("lasso cancel restores ink, apply moves it, clip can be reused", async ({
  page,
}) => {
  await blank(page);
  await path(page, [
    [310, 310],
    [430, 370],
    [490, 310],
  ]);
  const before = await ink(page);
  await button(page, "Cut").click();
  const lasso = [
    [270, 270],
    [540, 270],
    [540, 420],
    [270, 420],
    [270, 270],
  ];
  await path(page, lasso);
  await expect(button(page, "Apply selection")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toBeVisible();
  await expect.poll(() => ink(page)).toBe(before);
  await path(page, lasso);
  await button(page, "Save selection as clip").click();
  const box = await page.locator(".floating-selection").boundingBox();
  await path(page, [
    [box!.x + 70, box!.y + 60],
    [box!.x + 300, box!.y + 160],
  ]);
  await button(page, "Apply selection").click();
  await expect.poll(() => ink(page)).not.toBe(before);
  await button(page, "Undo").click();
  await expect.poll(() => ink(page)).toBe(before);
  await button(page, "Canvas Clips").click();
  await button(page, "Use saved clip").click();
  await expect(button(page, "Apply selection")).toBeVisible();
  await button(page, "Apply selection").click();
  await expect.poll(() => inkCount(page)).toBeGreaterThan(100);
});
test("image import, transform, crop, duplicate and save contain no recursive selection state", async ({
  page,
}) => {
  await blank(page);
  await button(page, "Collage").click();
  await page
    .locator(".drawing-workspace input[type=file]")
    .setInputFiles("tests/e2e/fixtures/photo.png");
  await expect(page.locator(".floating-selection")).toBeVisible();
  await button(page, "Rotate selection").click();
  await button(page, "Duplicate selection").click();
  await button(page, "Apply selection").click();
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.pages.find(
        (p: any) => p.id === l.journals[l.selected].pageIds[0],
      ).photos.length;
    })
    .toBe(2);
  await button(page, "Collage").click();
  await button(page, "Close dialog").click();
  await page.mouse.click(650, 470);
  await expect(button(page, "Cut out image")).toBeVisible();
  await button(page, "Cut out image").click();
  await path(page, [
    [580, 350],
    [780, 350],
    [780, 530],
    [580, 530],
    [580, 350],
  ]);
  await expect(button(page, "Apply selection")).toBeVisible();
  await button(page, "Apply selection").click();
  const l = await stored(page),
    photos = l.pages.find(
      (p: any) => p.id === l.journals[l.selected].pageIds[0],
    ).photos;
  expect(photos.every((p: any) => !p.before && !p.kind)).toBe(true);
  await button(page, "Undo").click();
  await button(page, "Redo").click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("fill, diagram, template, color and clean canvas settings", async ({
  page,
}) => {
  await blank(page);
  await button(page, "Fill").click();
  await path(page, [
    [250, 250],
    [500, 250],
    [500, 400],
    [250, 400],
    [250, 250],
  ]);
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.pages.find(
        (p: any) => p.id === l.journals[l.selected].pageIds[0],
      ).fill.length;
    })
    .toBeGreaterThan(100);
  await button(page, "Diagram").click();
  await path(page, [
    [630, 230],
    [870, 440],
  ]);
  await expect(button(page, "Apply selection")).toBeVisible();
  await button(page, "Apply selection").click();
  await expect.poll(() => inkCount(page)).toBeGreaterThan(100);
  await button(page, "Templates").click();
  await button(page, "Dot Grid").click();
  await button(page, "Close templates").click();
  await button(page, "Canvas settings").click();
  await page.getByRole("switch", { name: "Clean Canvas Mode" }).check();
  await button(page, "Close dialog").click();
  await expect(button(page, "Canvas settings")).toHaveCount(0);
  await button(page, "Show canvas controls").click();
  await expect(button(page, "Canvas settings")).toBeVisible();
  await button(page, "Hide tool tray").click();
  await button(page, "Show tool tray").click();
});
test("page duplication, grid move, journal lock and backup restore", async ({
  page,
}) => {
  await blank(page, "Private sketches");
  await button(page, "Close canvas").click();
  await button(page, "Page options").click();
  await button(page, "Duplicate page").click();
  await button(page, "Grid view").click();
  const firstIdBefore = (await stored(page)).journals.find(
    (j: any) => j.title === "Private sketches",
  ).pageIds[0];
  await button(page, "Open page 1").dispatchEvent("drop");
  expect(
    (await stored(page)).journals.find(
      (j: any) => j.title === "Private sketches",
    ).pageIds[0],
  ).toBe(firstIdBefore);
  await button(page, "Select pages").click();
  await button(page, "Open page 2").click();
  await button(page, "Move selected pages").click();
  await button(page, "Little Things").click();
  await expect(
    page.getByRole("heading", { name: "Private sketches" }),
  ).toBeVisible();
  await button(page, "Back to journals").click();
  await button(page, "Journal options").click();
  await button(page, "Add lock").click();
  await page.getByRole("textbox", { name: "Journal PIN" }).fill("1234");
  await button(page, "Set code").click();
  await button(page, "Export journal").click();
  await expect(
    page.getByRole("dialog", { name: "This journal is private" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Journal PIN" }).fill("9999");
  await button(page, "Open journal").click();
  await expect(
    page.getByText("That code does not match. Try again."),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Journal PIN" }).fill("1234");
  await button(page, "Open journal").click();
  await expect(
    page.getByRole("dialog", { name: "Share your journal" }),
  ).toBeVisible();
  await button(page, "Close dialog").click();
  await button(page, "Settings").click();
  const backup = page.waitForEvent("download");
  await button(
    page,
    "Export a backup All journals, drawings, notes, and palettes",
  ).click();
  const file = await (await backup).path();
  await page.locator("main>input[type=file]").first().setInputFiles(file!);
  await expect(
    page.getByRole("dialog", { name: "Restore these journals?" }),
  ).toBeVisible();
  await button(page, "Confirm").click();
  await expect(button(page, "Open Private sketches")).toBeVisible();
});
test("journal file export imports on home as an independent copy", async ({
  page,
}) => {
  await blank(page, "Travel log");
  await button(page, "Close canvas").click();
  await button(page, "Back to journals").click();
  await button(page, "Export journal").click();
  const dl = page.waitForEvent("download");
  await button(
    page,
    "Tinta file Open this journal on another device",
  ).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe("Travel log.tinta.json");
  await button(page, "Close dialog").click();
  const before = await stored(page);
  await page
    .locator("main>input[type=file]")
    .nth(2)
    .setInputFiles((await file.path())!);
  await expect(page.getByText("Imported Travel log")).toBeVisible();
  await expect
    .poll(async () => (await stored(page)).journals.length)
    .toBe(before.journals.length + 1);
  type StoredJournal = { id: string; title: string; pageIds: string[] };
  const journals: StoredJournal[] = (await stored(page)).journals;
  const copies = journals.filter((j) => j.title === "Travel log");
  expect(copies).toHaveLength(2);
  expect(copies[0].id).not.toBe(copies[1].id);
  expect(copies[0].pageIds[0]).not.toBe(copies[1].pageIds[0]);
  const owned = journals.flatMap((j) => j.pageIds);
  expect(new Set(owned).size).toBe(owned.length);
});

test("two-finger double tap undoes; single tap opens Rewind without leaving a touch stroke", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "This input test uses Chromium CDP; hardware/Safari touch needs a separate native session.",
  );
  await blank(page);
  const empty = await ink(page);
  await path(page, [
    [320, 260],
    [500, 330],
  ]);
  await expect.poll(() => inkCount(page)).toBeGreaterThan(100);
  const session = await page.context().newCDPSession(page);
  for (let tap = 0; tap < 2; tap++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 600, y: 400, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: 600, y: 400, id: 1 },
        { x: 700, y: 400, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ x: 700, y: 400, id: 2 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  await expect.poll(() => ink(page)).toBe(empty);
  await expect(button(page, "Redo")).toBeEnabled();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 600, y: 400, id: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 600, y: 400, id: 1 },
      { x: 700, y: 400, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [{ x: 700, y: 400, id: 2 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const wheel = page.getByRole("slider", { name: "Rewind history" });
  await expect(wheel).toBeVisible();
  await wheel.focus();
  await page.keyboard.press("End");
  await expect.poll(() => inkCount(page)).toBeGreaterThan(100);
  await page.keyboard.press("Home");
  await expect.poll(() => ink(page)).toBe(empty);
  await button(page, "Done").click();
});

test("a stale tab cannot overwrite journals saved in another tab", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator(".save-state")).toHaveAttribute(
    "title",
    "Saved on this device",
  );
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator(".save-state")).toHaveAttribute(
    "title",
    "Saved on this device",
  );
  await button(second, "Customize journal").click();
  await second
    .getByRole("textbox", { name: "Journal name" })
    .fill("Written in second tab");
  await expect(second.locator(".save-state")).toHaveAttribute(
    "title",
    "Saved on this device",
  );
  await button(page, "Customize journal").click();
  await page.getByRole("textbox", { name: "Journal name" }).fill("Stale title");
  await expect(page.getByRole("alert")).toContainText(
    "Another tab changed these journals",
  );
  const l = await stored(page);
  expect(l.journals[l.selected].title).toBe("Written in second tab");
  await second.close();
});

test("inline journal customization preserves typed text, cover, band and default template", async ({
  page,
}) => {
  await page.goto("/");
  await button(page, "New journal").click();
  const title = page.getByRole("textbox", { name: "Journal name" });
  await title.fill("");
  await title.pressSequentially("My Sketchbook", { delay: 20 });
  await expect(title).toHaveValue("My Sketchbook");
  await button(page, "Cover Image").click();
  await button(page, "Use covers-default-3 cover").click();
  await button(page, "Back to customization").click();
  await button(page, "Cover Band Color").click();
  await page.getByLabel("Cover band color", { exact: true }).fill("#223344");
  await button(page, "Back to customization").click();
  await button(page, "Page Template").click();
  await button(page, "Default template grid-dot").click();
  await button(page, "Close dialog").click();
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.journals[l.selected];
    })
    .toMatchObject({
      title: "My Sketchbook",
      cover: "/art/covers-default-3.svg",
      band: "#223344",
      template: "grid-dot",
    });
  await page.reload();
  await button(page, "Open My Sketchbook").click();
  await button(page, "New page").click();
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.pages.find(
        (p: any) => p.id === l.journals[l.selected].pageIds[1],
      )?.template;
    })
    .toBe("grid-dot");
});

test("deleting a saved template preserves existing pages, journal default and undo history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  await blank(page, "Template life cycle");
  await button(page, "Templates").click();
  await button(page, "Dot Grid").click();
  await button(page, "Capture template").click();
  await button(page, "Use custom template 1").click();
  await button(page, "Journal Default").click();
  await button(page, "Close templates").click();
  await button(page, "New canvas page").click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
  await button(page, "Fountain Pen").click();
  await path(page, [
    [250, 300],
    [480, 350],
  ]);
  await expect.poll(() => inkCount(page)).toBeGreaterThan(100);
  await button(page, "Templates").click();
  await button(page, "Delete custom template 1").click();
  await expect(button(page, "Use custom template 1")).toHaveCount(0);
  await button(page, "Close templates").click();
  await button(page, "Undo").click();
  await expect.poll(() => inkCount(page)).toBe(0);
  await expect
    .poll(async () => {
      const l = await stored(page),
        j = l.journals[l.selected];
      return (
        l.templates.length === 0 &&
        j.template.startsWith("data:image/png;base64,") &&
        j.pageIds.every(
          (id: string) =>
            l.pages.find((p: any) => p.id === id).template === j.template,
        )
      );
    })
    .toBe(true);
  await page.reload();
  await button(page, "Open Template life cycle").click();
  await button(page, "Open page 2").click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
  expect(errors).toEqual([]);
});

test("journal animation preserves image orientation and releases all GPU allocations", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const seen = new WeakSet<object>();
    const stats = { live: 0, top: [] as number[], bottom: [] as number[] };
    (window as any).animationProbe = stats;
    (HTMLCanvasElement.prototype as any).getContext = function (
      ...args: any[]
    ) {
      const gl = (original as any).apply(this, args);
      if (
        args[0] === "webgl2" &&
        this.classList.contains("page-crumple") &&
        gl &&
        !seen.has(gl)
      ) {
        seen.add(gl);
        for (const type of [
          "Shader",
          "Program",
          "Buffer",
          "VertexArray",
          "Texture",
        ]) {
          const create = gl["create" + type].bind(gl),
            remove = gl["delete" + type].bind(gl);
          const live = new Set();
          gl["create" + type] = (...values: any[]) => {
            const value = create(...values);
            if (value) {
              live.add(value);
              stats.live++;
            }
            return value;
          };
          gl["delete" + type] = (value: any) => {
            if (live.delete(value)) stats.live--;
            return remove(value);
          };
        }
        const draw = gl.drawElements.bind(gl);
        gl.drawElements = (...values: any[]) => {
          draw(...values);
          if (stats.top.length) return;
          const read = (y: number) => {
            const pixel = new Uint8Array(4);
            gl.readPixels(
              Math.floor(gl.drawingBufferWidth / 2),
              Math.floor(gl.drawingBufferHeight * y),
              1,
              1,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixel,
            );
            return Array.from(pixel);
          };
          stats.top = read(0.75);
          stats.bottom = read(0.25);
        };
      }
      return gl;
    };
  });
  await page.goto("/");
  await button(page, "New journal").click();
  await page
    .getByRole("textbox", { name: "Journal name" })
    .fill("Animation sample");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 300;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ff0000";
    g.fillRect(0, 0, 200, 150);
    g.fillStyle = "#0000ff";
    g.fillRect(0, 150, 200, 150);
    return c.toDataURL().split(",")[1];
  });
  await page
    .locator("main>input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "orientation.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.journals[l.selected].cover.startsWith("data:");
    })
    .toBe(true);
  await button(page, "Close dialog").click();
  await button(page, "Delete journal").click();
  await button(page, "Confirm").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).animationProbe.top))
    .toEqual([255, 0, 0, 255]);
  expect(
    await page.evaluate(() => (window as any).animationProbe.bottom),
  ).toEqual([0, 0, 255, 255]);
  await expect
    .poll(() => page.evaluate(() => (window as any).animationProbe.live))
    .toBe(0);
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.journals.length;
    })
    .toBe(5);
  await expect(page.locator("main")).not.toHaveAttribute("inert");
});

for (const fault of ["unavailable", "lost"] as const) {
  test(`confirmed page deletion completes once when animation GPU is ${fault}`, async ({
    page,
  }) => {
    await page.addInitScript((fault) => {
      const original = HTMLCanvasElement.prototype.getContext;
      (HTMLCanvasElement.prototype as any).getContext = function (
        ...args: any[]
      ) {
        if (args[0] === "webgl2" && this.classList.contains("page-crumple")) {
          if (fault === "unavailable") return null;
          const gl = (original as any).apply(this, args);
          setTimeout(
            () => gl?.getExtension("WEBGL_lose_context")?.loseContext(),
            0,
          );
          return gl;
        }
        return (original as any).apply(this, args);
      };
    }, fault);
    await blank(page, "GPU failure");
    await button(page, "New canvas page").click();
    await expect(
      page.getByRole("region", { name: "Drawing canvas" }),
    ).toHaveAttribute("data-ready", "true");
    await button(page, "Close canvas").click();
    await button(page, "Delete page").click();
    await button(page, "Confirm").click();
    await expect
      .poll(async () => {
        const l = await stored(page);
        return l.journals[l.selected].pageIds.length;
      })
      .toBe(1);
    await expect(page.locator("main")).not.toHaveAttribute("inert");
    await expect(button(page, "Open page 1")).toBeVisible();
    await page.reload();
    await button(page, "Open GPU failure").click();
    await button(page, "Open page 1").click();
    await expect(
      page.getByRole("region", { name: "Drawing canvas" }),
    ).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("a stalled deletion preview cannot leave the app locked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const OriginalImage = window.Image;
    window.Image = new Proxy(OriginalImage, {
      construct(target, args) {
        const image = Reflect.construct(target, args) as HTMLImageElement;
        const source = Object.getOwnPropertyDescriptor(
          HTMLImageElement.prototype,
          "src",
        )!;
        Object.defineProperty(image, "src", {
          get: () => source.get!.call(image),
          set: (value) => {
            if (!(window as any).stallPreview) source.set!.call(image, value);
          },
        });
        return image;
      },
    });
  });
  await page.goto("/");
  await button(page, "Open Design Project").click();
  await expect(button(page, "Delete page")).toBeVisible();
  await button(page, "Delete page").click();
  await page.evaluate(() => {
    (window as any).stallPreview = true;
  });
  await button(page, "Confirm").click();
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.journals[l.selected].pageIds.length;
    })
    .toBe(3);
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await page.evaluate(() => {
    (window as any).stallPreview = false;
  });
  await button(page, "Back to journals").click();
  await expect(button(page, "New journal")).toBeVisible();
});

test("Rewind scrubs both directions and a new stroke replaces the future", async ({
  page,
}) => {
  await blank(page);
  const empty = await ink(page);
  await path(page, [
    [300, 280],
    [510, 300],
  ]);
  const one = await ink(page);
  await path(page, [
    [300, 360],
    [510, 400],
  ]);
  const two = await ink(page);
  await button(page, "Undo").click({ button: "right" });
  const wheel = page.getByRole("slider", { name: "Rewind history" });
  await expect(wheel).toHaveAttribute("aria-valuenow", "2");
  await wheel.focus();
  await page.keyboard.press("Home");
  await expect.poll(() => ink(page)).toBe(empty);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => ink(page)).toBe(one);
  await page.keyboard.press("End");
  await expect.poll(() => ink(page)).toBe(two);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => ink(page)).toBe(one);
  await button(page, "Done").click();
  // A right-click must not also schedule a hold that reopens Rewind later.
  await expect(wheel).toHaveCount(0);
  await page.waitForTimeout(550);
  await expect(wheel).toHaveCount(0);
  await path(page, [
    [600, 290],
    [780, 330],
  ]);
  await expect(button(page, "Redo")).toBeDisabled();
  await button(page, "Undo").click();
  await expect.poll(() => ink(page)).toBe(one);
});

test("palette swipes create empty palettes past the end and tool swipes adjust individual sizes", async ({
  page,
}) => {
  await blank(page);
  for (let i = 0; i < 3; i++) await button(page, "Add palette").click();
  await expect.poll(async () => (await stored(page)).palettes.length).toBe(10);
  await expect(page.locator(".swatch[data-empty=true]")).toHaveCount(7);
  const palette = await page.locator(".palettes").boundingBox();
  await path(page, [
    [palette!.x + 150, palette!.y + 20],
    [palette!.x + 50, palette!.y + 20],
  ]);
  await expect.poll(async () => (await stored(page)).palettes.length).toBe(11);
  await button(page, "Delete palette").click();
  await expect.poll(async () => (await stored(page)).palettes.length).toBe(10);
  const tool = await button(page, "Pencil").boundingBox();
  await path(page, [
    [tool!.x + tool!.width / 2, tool!.y + 55],
    [tool!.x + tool!.width / 2, tool!.y + 12],
  ]);
  await expect(button(page, "Large brush")).toHaveClass("selected");
  await button(page, "Large brush").click();
  await expect(button(page, "Pencil").locator("img")).toHaveAttribute(
    "src",
    /-selected-lg/,
  );
  const erase = await button(page, "Eraser").boundingBox();
  await page.mouse.move(erase!.x + erase!.width / 2, erase!.y + 60);
  await page.mouse.down();
  await expect(
    page.getByRole("dialog", { name: "A fresh start" }),
  ).toBeVisible();
  await page.mouse.up();
  await button(page, "Close dialog").click();
  await page.reload();
  await button(page, "Open Test journal").click();
  await button(page, "Open page 1").click();
  await expect.poll(async () => (await stored(page)).palettes.length).toBe(10);
  await expect(button(page, "Pencil").locator("img")).toHaveAttribute(
    "src",
    /-unselected-lg/,
  );
});

test("local OCR reads actual pixels, saves an editable note, and cancels its worker", async ({
  page,
}) => {
  test.setTimeout(60000);
  const remote: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:5173")
    )
      remote.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await blank(page);
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 300;
    const g = c.getContext("2d")!;
    g.fillStyle = "white";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "black";
    g.font = "64px Arial";
    g.fillText("PAPER NOTES 123", 55, 170);
    return c.toDataURL().split(",")[1];
  });
  await button(page, "Collage").click();
  await page.locator(".drawing-workspace input[type=file]").setInputFiles({
    name: "text.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await button(page, "Apply selection").click();
  await button(page, "Convert to text").click();
  const output = page.getByRole("textbox", { name: "Converted text" });
  await expect(output).toHaveValue(/PAPER NOTES 123/, { timeout: 40000 });
  await output.fill("PAPER NOTES 123\nReviewed locally");
  await page.screenshot({ path: `${SCREENSHOTS}/convert-text-ipad.png` });
  await button(page, "Save to note").click();
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.pages.find(
        (p: any) => p.id === l.journals[l.selected].pageIds[0],
      ).note;
    })
    .toBe("PAPER NOTES 123\nReviewed locally");
  await button(page, "Undo").click();
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.pages.find(
        (p: any) => p.id === l.journals[l.selected].pageIds[0],
      ).note;
    })
    .toBe("");
  await button(page, "Convert to text").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Reading your page" }),
  ).toBeVisible();
  await button(page, "Close dialog").click();
  await expect(
    page.getByRole("dialog", { name: "Convert to text" }),
  ).toHaveCount(0);
  await expect(button(page, "Undo")).toBeEnabled();
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
});

test("color drags preserve artwork, mixer saves a swatch, and eyedropper persists the sampled color", async ({
  page,
}) => {
  await blank(page);
  await path(page, [
    [320, 230],
    [500, 270],
  ]);
  const drawing = await ink(page);
  const selected = button(page, "Color swatch 3");
  const value = await selected.getAttribute("title");
  const box = await selected.boundingBox();
  await path(page, [
    [box!.x + box!.width / 2, box!.y + box!.height / 2],
    [650, 410],
  ]);
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.pages.find(
        (p: any) => p.id === l.journals[l.selected].pageIds[0],
      ).background;
    })
    .toBe(value);
  await expect.poll(() => ink(page)).toBe(drawing);
  const mix = await button(page, "Color mixer").boundingBox();
  const slot = await button(page, "Color swatch 2").boundingBox();
  await page.mouse.move(mix!.x + mix!.width / 2, mix!.y + mix!.height / 2);
  await page.mouse.down();
  await expect(page.locator(".drag-color")).toBeVisible();
  await page.mouse.move(slot!.x + slot!.width / 2, slot!.y + slot!.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(button(page, "Color swatch 2")).toHaveAttribute(
    "title",
    "#e9d6a5",
  );
  await button(page, "Color swatch 1").click();
  await expect(page.getByRole("dialog", { name: "Edit color" })).toBeVisible();
  await button(page, "Pick color from canvas").click();
  await path(page, [
    [620, 380],
    [760, 420],
  ]);
  await page.mouse.click(770, 440);
  await expect(button(page, "Color swatch 1")).toHaveAttribute("title", value!);
  await expect.poll(() => ink(page)).toBe(drawing);
  await button(page, "Close color picker").click();
  await button(page, "Undo").click();
  await expect
    .poll(async () => {
      const l = await stored(page);
      return l.pages.find(
        (p: any) => p.id === l.journals[l.selected].pageIds[0],
      ).background;
    })
    .not.toBe(value);
  await expect.poll(() => ink(page)).toBe(drawing);
});

test("cancel and language-load errors terminate the OCR worker and preserve the page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.Worker;
    const counts = { created: 0, terminated: 0 };
    (window as any).__ocrWorkers = counts;
    window.Worker = class extends Original {
      closed = false;
      tracked = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.tracked = String(url).includes("/ocr/");
        if (this.tracked) counts.created++;
      }
      terminate() {
        if (this.tracked && !this.closed) {
          this.closed = true;
          counts.terminated++;
        }
        super.terminate();
      }
    } as typeof Worker;
  });
  await blank(page);
  await path(page, [
    [300, 220],
    [520, 290],
  ]);
  const before = await ink(page);
  await page.route("**/ocr/eng.traineddata.gz", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await button(page, "Convert to text").click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 20000 });
  await expect
    .poll(() => page.evaluate(() => (window as any).__ocrWorkers))
    .toEqual({ created: 1, terminated: 1 });
  await button(page, "Close dialog").click();
  await page.unroute("**/ocr/eng.traineddata.gz");
  await button(page, "Convert to text").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__ocrWorkers.created))
    .toBe(2);
  await button(page, "Close dialog").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__ocrWorkers))
    .toEqual({ created: 2, terminated: 2 });
  await expect.poll(() => ink(page)).toBe(before);
});
