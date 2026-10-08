import type { Page } from "./model";
import { asset, templateAsset } from "./model";
const images = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!images.has(src)) {
    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        images.delete(src);
        reject(new Error("Could not load image."));
      };
      image.src = src;
    });
    images.set(src, p);
    if (images.size > 80) images.delete(images.keys().next().value!);
  }
  return images.get(src)!;
}
export const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
export async function composePage(
  page: Page,
  background = true,
  customTemplates: { id: string; src: string }[] = [],
): Promise<HTMLCanvasElement> {
  const c = canvas(page.width, page.height),
    ctx = c.getContext("2d")!;
  if (background) {
    ctx.fillStyle = page.background;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  if (page.template) {
    const src =
      customTemplates.find((t) => t.id === page.template)?.src ||
      templateAsset(page.template, page.width, page.height);
    try {
      ctx.drawImage(await loadImage(src), 0, 0, c.width, c.height);
    } catch {}
  }
  for (const photo of page.photos) {
    const im = await loadImage(photo.src);
    ctx.save();
    ctx.translate(photo.x + photo.width / 2, photo.y + photo.height / 2);
    ctx.rotate(photo.rotation);
    ctx.drawImage(
      im,
      -photo.width / 2,
      -photo.height / 2,
      photo.width,
      photo.height,
    );
    ctx.restore();
  }
  for (const src of [page.fill, page.ink])
    if (src) ctx.drawImage(await loadImage(src), 0, 0, c.width, c.height);
  return c;
}
export async function thumbnail(
  page: Page,
  templates: { id: string; src: string }[] = [],
) {
  const source = await composePage(page, true, templates);
  const c = canvas(420, Math.round((420 * page.height) / page.width));
  c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.78);
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image export failed."))),
      "image/png",
    ),
  );
}
export async function fileImage(file: File) {
  if (file.size > 30 * 1024 * 1024)
    throw new Error("Choose an image smaller than 30 MB.");
  const url = URL.createObjectURL(file);
  try {
    const im = await loadImage(url);
    const s = Math.min(1, 2752 / Math.max(im.width, im.height));
    const c = canvas(Math.round(im.width * s), Math.round(im.height * s));
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
    return { src: c.toDataURL("image/png"), width: c.width, height: c.height };
  } finally {
    URL.revokeObjectURL(url);
    images.delete(url);
  }
}
export async function exportPDF(
  pages: Page[],
  title: string,
  background: boolean,
  templates: { id: string; src: string }[],
) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  await document.fonts.ready;
  const append = async (c: HTMLCanvasElement) => {
    const im = await pdf.embedPng(await (await toBlob(c)).arrayBuffer());
    const sheet = pdf.addPage([c.width * 0.5, c.height * 0.5]);
    sheet.drawImage(im, {
      x: 0,
      y: 0,
      width: c.width * 0.5,
      height: c.height * 0.5,
    });
  };
  for (const p of pages) {
    if (p.ink || p.fill || p.photos.length || p.template)
      await append(await composePage(p, background, templates));
    if (!p.note) continue;
    // Notes follow their artwork and paginate; every line is retained, including
    // Unicode text. Raster text avoids an incomplete subset of PDF glyphs.
    const c = canvas(p.width, p.height),
      ctx = c.getContext("2d")!;
    const fontSize = Math.min(24, p.width / 28),
      margin = fontSize * 1.7,
      lineHeight = fontSize * 1.4;
    ctx.font = fontSize + "px Inter, system-ui, sans-serif";
    const lines: string[] = [];
    for (const paragraph of p.note.split("\n")) {
      let line = "";
      for (const char of Array.from(paragraph)) {
        if (line && ctx.measureText(line + char).width > p.width - margin * 2) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
      lines.push(line);
    }
    const perPage = Math.max(
      1,
      Math.floor((p.height - margin * 2) / lineHeight),
    );
    for (let start = 0; start < lines.length; start += perPage) {
      ctx.clearRect(0, 0, c.width, c.height);
      if (background) {
        ctx.fillStyle = p.background;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.fillStyle = "#26343a";
      lines
        .slice(start, start + perPage)
        .forEach((line, i) =>
          ctx.fillText(line, margin, margin + fontSize + i * lineHeight),
        );
      await append(c);
    }
  }
  if (pdf.getPageCount() === 0)
    throw new Error("Add a drawing or note before exporting this journal.");
  download(
    new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" }),
    title + ".pdf",
  );
}
