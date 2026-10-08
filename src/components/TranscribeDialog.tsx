import { useEffect, useState } from "react";
import type { Library, Page } from "../lib/model";
import { composePage } from "../lib/images";
import { transcribe } from "../lib/transcribe";
import { Modal } from "./UI";

export default function TranscribeDialog({
  page,
  templates,
  onSave,
  onClose,
}: {
  page: Page;
  templates: Library["templates"];
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(true);
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setBusy(false);
      setError("Conversion took too long. Close this window and try again.");
    }, 60000);
    void composePage(page, true, templates)
      .then((source) => transcribe(source, controller.signal, setProgress))
      .then((value) => {
        if (!controller.signal.aborted) {
          setText(value);
          setBusy(false);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not convert this page.",
          );
          setBusy(false);
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [page, templates]);
  return (
    <Modal
      title="Convert to text"
      onClose={onClose}
      className="transcribe-dialog"
    >
      {busy ? (
        <div className="transcribe-progress" role="status">
          <p>Reading your page…</p>
          <progress aria-label="Conversion progress" value={progress} max={1} />
        </div>
      ) : (
        <>
          {error ? (
            <p role="alert">{error}</p>
          ) : (
            <>
              <p>
                {text
                  ? "Review the text before saving."
                  : "No text found. You can type a note below."}
              </p>
              <textarea
                aria-label="Converted text"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setCopied(false);
                  setCopyError("");
                }}
                rows={9}
              />
            </>
          )}
          {copyError && <p role="status">{copyError}</p>}
          <div className="modal-actions">
            <button onClick={onClose}>Cancel</button>
            {!error && (
              <>
                <button
                  disabled={!text.trim()}
                  onClick={() => {
                    const unavailable = () =>
                      setCopyError(
                        "Copy is unavailable. Select the text and copy it manually.",
                      );
                    if (!navigator.clipboard) {
                      unavailable();
                      return;
                    }
                    void navigator.clipboard.writeText(text).then(() => {
                      setCopied(true);
                      setCopyError("");
                    }, unavailable);
                  }}
                >
                  {copied ? "Copied" : "Copy text"}
                </button>
                <button
                  className="primary-button"
                  disabled={!text.trim()}
                  onClick={() => onSave(text.trim())}
                >
                  Save to note
                </button>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
