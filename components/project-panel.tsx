"use client";

import { useState } from "react";

interface ProjectPanelProps {
  content: string;
  onSave: (content: string) => void;
}

export function ProjectPanel({ content, onSave }: ProjectPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  function handleEdit() {
    setDraft(content);
    setEditing(true);
  }

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  function handleCancel() {
    setEditing(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end p-3 gap-2">
        {!editing ? (
          <button
            type="button"
            onClick={handleEdit}
            className="text-[12px] font-medium"
            style={{ color: "var(--accent)" }}
          >
            Bearbeiten
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleCancel}
              className="text-[12px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-[12px] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              Sichern
            </button>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-full text-[13px] font-mono leading-relaxed rounded-xl p-3 resize-none focus:outline-none focus:ring-2"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        ) : (
          <div
            className="text-[13px] font-mono leading-relaxed whitespace-pre-wrap rounded-xl p-3"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
          >
            {content || "Kein Projektstand vorhanden."}
          </div>
        )}
      </div>
    </div>
  );
}
