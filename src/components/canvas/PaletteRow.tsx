import { ChevronLeft, ChevronRight } from "lucide-react";
import { Icon, IconButton } from "../UI";
import type { ColorDragApi } from "./useColorDrag";

interface PaletteRowProps {
  palettes: string[][];
  palette: number;
  swatch: number;
  customColor: string | null;
  colorDrag: ColorDragApi;
  onAddPalette: () => void;
  onChangePalette: (direction: number) => void;
  onSwatchClick: (index: number, color: string) => void;
  onDeletePalette: () => void;
  onOpenClips: () => void;
  onHideTray: () => void;
}

export default function PaletteRow({
  palettes,
  palette,
  swatch,
  customColor,
  colorDrag,
  onAddPalette,
  onChangePalette,
  onSwatchClick,
  onDeletePalette,
  onOpenClips,
  onHideTray,
}: PaletteRowProps) {
  return (
    <div className="palette-row">
      <IconButton
        label="Add palette"
        name="canvas-tray-add-palette"
        onClick={onAddPalette}
      />
      <div
        className="palettes"
        aria-label="Color palettes"
        onPointerDown={(e) => {
          colorDrag.paletteSwipe.current = { x: e.clientX, y: e.clientY };
          colorDrag.ignorePaletteClick.current = false;
        }}
        onPointerMove={(e) => {
          if (colorDrag.active()) return;
          const g = colorDrag.paletteSwipe.current;
          if (!g) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            onChangePalette(dx < 0 ? 1 : -1);
            colorDrag.paletteSwipe.current = null;
            colorDrag.ignorePaletteClick.current = true;
            e.preventDefault();
          }
        }}
        onPointerUp={() => {
          colorDrag.paletteSwipe.current = null;
        }}
        onPointerCancel={() => {
          colorDrag.paletteSwipe.current = null;
        }}
        onClickCapture={(e) => {
          if (colorDrag.ignorePaletteClick.current) {
            e.preventDefault();
            e.stopPropagation();
            colorDrag.ignorePaletteClick.current = false;
          }
        }}
      >
        <button
          className="palette-arrow"
          aria-label="Previous palette"
          disabled={palette === 0}
          onClick={() => onChangePalette(-1)}
        >
          <ChevronLeft size={13} />
        </button>
        <div className="swatches">
          {palettes[palette].map((c, i) => (
            <button
              key={i}
              aria-label={"Color swatch " + (i + 1)}
              title={c || "Empty color"}
              draggable={false}
              onPointerDown={(e) => colorDrag.start(e, c)}
              onPointerMove={(e) => colorDrag.move(e, true)}
              onPointerUp={(e) => colorDrag.end(e)}
              onPointerCancel={() => colorDrag.end()}
              className={
                "swatch " + (i === swatch && !customColor ? "selected" : "")
              }
              style={{ background: c || "transparent" }}
              data-empty={!c}
              data-swatch={i}
              onClick={() => onSwatchClick(i, c)}
            />
          ))}
        </div>
        <button
          className="palette-arrow"
          aria-label="Next palette"
          onClick={() => onChangePalette(1)}
        >
          <ChevronRight size={13} />
        </button>
      </div>
      <IconButton
        label="Delete palette"
        name="canvas-tray-delete-palette"
        disabled={palettes.length === 1}
        onClick={onDeletePalette}
      />
      <IconButton label="Canvas Clips" onClick={onOpenClips}>
        <Icon name="canvas-tray-add-clip" />
      </IconButton>
      <IconButton
        label="Hide tool tray"
        name="canvas-shell-show-tool-tray"
        onClick={onHideTray}
      />
    </div>
  );
}
