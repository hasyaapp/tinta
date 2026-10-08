import { test, expect } from "@playwright/test";
test("production opens and draws offline after the complete reference cache is ready", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Open Design Project", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  const entries = await page.evaluate(async () => {
    const name = (await caches.keys()).find((n) => n.startsWith("tinta-"))!;
    return (await (await caches.open(name)).keys()).length;
  });
  expect(entries).toBeGreaterThan(50);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Open Design Project", exact: true })
    .click();
  await page.getByRole("button", { name: "Open page 1", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
  await page
    .getByRole("button", { name: "New canvas page", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Drawing canvas" }),
  ).toHaveAttribute("data-ready", "true");
  await page.mouse.move(350, 250);
  await page.mouse.down();
  await page.mouse.move(550, 370, { steps: 16 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  // OCR must work on its first use after going offline, including the worker,
  // selected SIMD core and language model, rather than relying on warmed URLs.
  const textPNG = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 250;
    const g = c.getContext("2d")!;
    g.fillStyle = "white";
    g.fillRect(0, 0, 900, 250);
    g.fillStyle = "black";
    g.font = "64px Arial";
    g.fillText("OFFLINE PAPER", 30, 150);
    return c.toDataURL().split(",")[1];
  });
  await page.getByRole("button", { name: "Collage", exact: true }).click();
  await page
    .locator(".drawing-workspace input[type=file]")
    .setInputFiles({
      name: "offline-text.png",
      mimeType: "image/png",
      buffer: Buffer.from(textPNG, "base64"),
    });
  await page
    .getByRole("button", { name: "Apply selection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Convert to text", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Converted text" }),
  ).toHaveValue(/OFFLINE PAPER/, { timeout: 30000 });
  await page.getByRole("button", { name: "Save to note", exact: true }).click();
  await page
    .getByRole("button", { name: "Export drawing", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "PDF document This page", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
