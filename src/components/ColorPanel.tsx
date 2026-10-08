import { useState } from "react";
import { Pipette, PaintBucket, X } from "lucide-react";
import { hexToHSV, hsvToHex } from "../lib/color";
export default function ColorPanel({
  color,
  onChange,
  onClose,
  onPicker,
  onBackground,
}: {
  color: string;
  onChange: (s: string) => void;
  onClose: () => void;
  onPicker: () => void;
  onBackground: () => void;
}) {
  const [hex, setHex] = useState(color);
  const [h, s, v] = hexToHSV(color);
  return (
    <div className="color-panel" role="dialog" aria-label="Edit color">
      <div className="color-panel-header">
        <span>Make it your color</span>
        <button aria-label="Close color picker" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="color-sliders">
        {[
          {
            name: "Hue",
            max: 360,
            value: h,
            className: "hue",
            onChange: (n: number) => hsvToHex(n, s, v),
          },
          {
            name: "Saturation",
            max: 100,
            value: s * 100,
            className: "saturation",
            onChange: (n: number) => hsvToHex(h, n / 100, v),
          },
          {
            name: "Brightness",
            max: 100,
            value: v * 100,
            className: "brightness",
            onChange: (n: number) => hsvToHex(h, s, n / 100),
          },
        ].map((sl) => (
          <label key={sl.name}>
            <span>{sl.name}</span>
            <input
              aria-label={sl.name}
              type="range"
              className={sl.className}
              min={0}
              max={sl.max}
              value={sl.value}
              style={{ "--color": color } as React.CSSProperties}
              onChange={(e) => {
                const value = sl.onChange(+e.target.value);
                onChange(value);
                setHex(value);
              }}
            />
          </label>
        ))}
      </div>
      <div className="color-panel-bottom">
        <div className="color-chip" style={{ background: color }} />
        <input
          aria-label="Hex color"
          value={hex}
          onChange={(e) => {
            setHex(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value))
              onChange(e.target.value);
          }}
          onBlur={() => setHex(color)}
        />
        <button
          title="Pick from canvas"
          aria-label="Pick color from canvas"
          onClick={onPicker}
        >
          <Pipette size={19} />
        </button>
        <button
          title="Set page background"
          aria-label="Set page background"
          onClick={onBackground}
        >
          <PaintBucket size={19} />
        </button>
      </div>
    </div>
  );
}
