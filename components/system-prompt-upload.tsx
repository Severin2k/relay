"use client";

import { useRef } from "react";

interface SystemPromptUploadProps {
  label?: string;
  promptName: string;
  onUpload: (content: string, fileName: string) => void;
}

export function SystemPromptUpload({ label, promptName, onUpload }: SystemPromptUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onUpload(reader.result as string, file.name);
    };
    reader.readAsText(file);

    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="text-[11px] font-medium rounded-full px-2.5 py-1 transition-colors"
        style={{ color: "var(--accent)", background: "transparent" }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        {label || "Prompt"}
      </button>
      {promptName && (
        <span className="text-[10px] truncate max-w-[80px]" style={{ color: "var(--text-tertiary)" }}>{promptName}</span>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".md,.txt"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
