import { useState } from "react";
import { Modal } from "../UI";

interface PinDialogProps {
  mode: "lock" | "unlock";
  locked: boolean;
  onSubmit: (pin: string, fail: (message: string) => void) => void;
  onClose: () => void;
}

export default function PinDialog({
  mode,
  locked,
  onSubmit,
  onClose,
}: PinDialogProps) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  return (
    <Modal
      title={
        mode === "unlock"
          ? "This journal is private"
          : locked
            ? "Remove journal lock"
            : "A little more privacy"
      }
      onClose={onClose}
    >
      <p className="muted">
        {mode === "unlock" || locked
          ? "Enter your four-digit code."
          : "Choose a four-digit code to hide this journal on a shared device. This locks the app view; it does not encrypt a backup."}
      </p>
      <input
        className="pin-input"
        aria-label="Journal PIN"
        inputMode="numeric"
        type="password"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
      />
      {pinError && <p className="danger">{pinError}</p>}
      <button
        className="primary-button"
        disabled={pin.length !== 4}
        onClick={() => onSubmit(pin, setPinError)}
      >
        {mode === "unlock"
          ? "Open journal"
          : locked
            ? "Remove lock"
            : "Set code"}
      </button>
    </Modal>
  );
}
