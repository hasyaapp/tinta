import type { Library, Page } from "../lib/model";
import { asset, templateAsset } from "../lib/model";
export default function PagePreview({
  page,
  templates = [],
}: {
  page?: Page;
  templates?: Library["templates"];
}) {
  if (!page) return <div className="page-preview" />;
  return (
    <div
      className="page-preview"
      style={{
        background: page.background,
        aspectRatio: page.width + "/" + page.height,
      }}
    >
      {page.thumbnail ? (
        <img src={page.thumbnail} alt="" draggable={false} />
      ) : (
        <>
          {page.template && (
            <img
              draggable={false}
              alt=""
              src={
                templates.find((t) => t.id === page.template)?.src ||
                templateAsset(page.template, page.width, page.height)
              }
            />
          )}
          {page.photos.map((p) => (
            <img
              key={p.id}
              alt=""
              draggable={false}
              src={p.src}
              style={{
                left: (p.x / page.width) * 100 + "%",
                top: (p.y / page.height) * 100 + "%",
                width: (p.width / page.width) * 100 + "%",
                height: (p.height / page.height) * 100 + "%",
                transform: "rotate(" + p.rotation + "rad)",
              }}
            />
          ))}
          {page.fill && <img src={page.fill} alt="" draggable={false} />}{" "}
          {page.ink && <img src={page.ink} alt="" draggable={false} />}
        </>
      )}
      {page.note && (
        <div
          className={
            "preview-note " + (!page.ink && !page.fill ? "note-full" : "")
          }
        >
          {page.note
            .split("\n")
            .slice(0, 8)
            .map((line, i) => (
              <div key={i}>{line || "\u00a0"}</div>
            ))}
        </div>
      )}
    </div>
  );
}
