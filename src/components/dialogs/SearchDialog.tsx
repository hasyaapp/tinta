import { useState } from "react";
import { Search } from "lucide-react";
import type { Journal } from "../../lib/model";
import { Drop, Modal } from "../UI";

// Row of the "Your Journals" sheet. Matches the native list: cover, title,
// page count, modified time, and the order controls. A trailing drag handle is
// not faked because reordering here is done with the two arrow buttons.
function JournalRow({
  journal,
  index,
  total,
  onOpen,
  onMove,
}: {
  journal: Journal;
  index: number;
  total: number;
  onOpen: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const pages = journal.pageIds.length;
  const minutes =
    typeof journal.updatedAt === "number"
      ? Math.max(0, Math.round((Date.now() - journal.updatedAt) / 60000))
      : null;
  return (
    <div className="journal-list-item">
      <button onClick={onOpen}>
        <img src={journal.cover} alt="" />
        <span>
          <strong>{journal.title}</strong>
          <small>
            {pages} {pages === 1 ? "Page" : "Pages"}
            {minutes !== null
              ? " / " + (minutes < 1 ? "1m" : minutes + "m")
              : ""}
          </small>
        </span>
      </button>
      <div className="reorder-buttons">
        <button
          aria-label={"Move " + journal.title + " up"}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          aria-label={"Move " + journal.title + " down"}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
      </div>
    </div>
  );
}

interface SearchDialogProps {
  journals: Journal[];
  onOpen: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onClose: () => void;
}

export default function SearchDialog({
  journals,
  onOpen,
  onMove,
  onClose,
}: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const journalEntries = journals.map((j, i) => ({ j, i }));
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? journalEntries.filter(({ j }) => j.title.toLowerCase().includes(needle))
    : journalEntries;
  const recent = needle
    ? []
    : [...journalEntries]
        .filter(({ j }) => typeof j.updatedAt === "number")
        .sort((a, b) => (b.j.updatedAt ?? 0) - (a.j.updatedAt ?? 0))
        .slice(0, 3);
  return (
    <Modal title="Your Journals" onClose={onClose}>
      <div className="search-field">
        <Search size={19} />
        <input
          autoFocus
          placeholder="Search by title"
          aria-label="Search journals by title"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="journal-list">
        {!needle && recent.length > 0 && (
          <>
            <h3 className="journal-list-group">Last Edited</h3>
            {recent.map(({ j, i }) => (
              <JournalRow
                key={j.id}
                journal={j}
                index={i}
                total={journals.length}
                onOpen={() => onOpen(i)}
                onMove={(dir) => onMove(i, dir)}
              />
            ))}
          </>
        )}
        <h3 className="journal-list-group">On this device ({journals.length})</h3>
        {matches.length === 0 && (
          <p className="journal-list-empty">
            <Drop size={18} />
            No journals with that name yet. Try fewer letters.
          </p>
        )}
        {matches.map(({ j, i }) => (
          <JournalRow
            key={j.id}
            journal={j}
            index={i}
            total={journals.length}
            onOpen={() => onOpen(i)}
            onMove={(dir) => onMove(i, dir)}
          />
        ))}
      </div>
    </Modal>
  );
}
