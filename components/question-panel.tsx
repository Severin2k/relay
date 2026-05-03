"use client";

import { useState } from "react";

export interface Question {
  id: string;
  from: "plan" | "coder";
  text: string;
  timestamp: number;
  answered: boolean;
  answer?: string;
}

interface QuestionPanelProps {
  questions: Question[];
  onAnswer: (questionId: string, answer: string) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function QuestionCard({ q, onAnswer }: { q: Question; onAnswer: (answer: string) => void }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(!q.answered);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onAnswer(text);
    setInput("");
    setOpen(false);
  }

  const isPlan = q.from === "plan";

  return (
    <div
      className={`rounded-xl p-3 transition-opacity ${q.answered ? "opacity-40" : ""}`}
      style={{ background: "var(--bg-primary)", boxShadow: q.answered ? "none" : "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            background: isPlan ? "var(--bg-tertiary)" : "var(--indigo-bg)",
            color: isPlan ? "var(--text-secondary)" : "var(--indigo)",
          }}
        >
          {isPlan ? "Plan" : "Coder"}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{formatTime(q.timestamp)}</span>
        {!q.answered && (
          <span className="w-2 h-2 rounded-full animate-pulse ml-auto" style={{ background: "var(--red)" }} />
        )}
      </div>
      <p className="text-[13px] leading-relaxed mb-2" style={{ color: "var(--text-primary)" }}>{q.text}</p>
      {q.answered && q.answer && (
        <p className="text-[12px] italic" style={{ color: "var(--text-tertiary)" }}>Antwort: {q.answer}</p>
      )}
      {!q.answered && open && (
        <form onSubmit={handleSubmit} className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Antwort..."
            className="flex-1 text-[13px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white transition-colors"
            style={{ background: "var(--accent)" }}
          >
            Senden
          </button>
        </form>
      )}
      {!q.answered && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[12px] font-medium"
          style={{ color: "var(--accent)" }}
        >
          Antworten
        </button>
      )}
    </div>
  );
}

export function QuestionPanel({ questions, onAnswer }: QuestionPanelProps) {
  const unanswered = questions.filter((q) => !q.answered);
  const answered = questions.filter((q) => q.answered);
  const sorted = [...unanswered.reverse(), ...answered.reverse()];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 && (
          <p className="text-[13px] text-center mt-12" style={{ color: "var(--text-tertiary)" }}>Keine Fragen</p>
        )}
        {sorted.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            onAnswer={(answer) => onAnswer(q.id, answer)}
          />
        ))}
      </div>
    </div>
  );
}
