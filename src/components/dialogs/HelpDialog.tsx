import { Modal } from "../UI";

interface HelpDialogProps {
  onClose: () => void;
}

export default function HelpDialog({ onClose }: HelpDialogProps) {
  return (
    <Modal title="Think with your hands" onClose={onClose}>
      <div className="help-list">
        <p>
          <strong>Make a mark.</strong> Pick a tool in the tray. Tap the
          selected tool to change its size. Use a Pencil, your finger, or a
          mouse.
        </p>
        <p>
          <strong>Find your way.</strong> Tap a journal, then a page. Pinch to
          zoom. Swipe from the canvas edges to turn a page.
        </p>
        <p>
          <strong>Try again.</strong> Undo with the arrow, a two-finger double
          tap, or ⌘Z. Shift-⌘Z brings it back.
        </p>
        <p>
          <strong>Move things around.</strong> Draw around ink with Cut. Move,
          resize, rotate, duplicate, or keep the selection as a clip.
        </p>
        <p>
          <strong>Add some color.</strong> Tap a swatch twice to edit it. Drag
          a swatch onto the page to change its background.
        </p>
        <p>
          <strong>Keep your ideas.</strong> Your work saves on this device.
          Export a backup from Settings to take your journals with you.
        </p>
      </div>
      <p className="settings-footnote">
        Tinta · Reference version 5.5.10
        <br />
        Build{" "}
        {document
          .querySelector('meta[name="paper-build"]')
          ?.getAttribute("content") || "dev"}
        <br />
        Native cloud and subscription services are not connected.
      </p>
    </Modal>
  );
}
