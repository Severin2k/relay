"use client";

import { useState, useRef, useEffect, useCallback, FormEvent } from "react";
import { Message } from "./message";
import { SystemPromptUpload } from "./system-prompt-upload";
import { QuestionPanel, Question } from "./question-panel";
import { ProjectPanel } from "./project-panel";
import {
  PLAN_OPTIONS,
  CODER_OPTIONS,
  DEFAULT_PLAN,
  DEFAULT_CODER,
  findOption,
} from "@/lib/llm-options";

interface ChatMessage {
  id: string;
  role: "user" | "plan" | "coder";
  content: string;
  to?: "plan" | "coder";
  auto?: boolean;
  build?: boolean;
}

const STORAGE_KEY_PLAN_LLM = "relay_plan_llm";
const STORAGE_KEY_CODER_LLM = "relay_coder_llm";
const STORAGE_KEY_PROMPT = "relay_system_prompt";
const STORAGE_KEY_PROMPT_NAME = "relay_system_prompt_name";
const STORAGE_KEY_CODER_PROMPT = "relay_coder_system_prompt";
const STORAGE_KEY_CODER_PROMPT_NAME = "relay_coder_system_prompt_name";

const DEFAULT_CODER_PROMPT = `Du siehst den kompletten Chatverlauf zwischen dem User und dem Plan-LLM.
Deine Rolle: technische Pläne reviewen, Fehler finden, Verbesserungen vorschlagen.
Wenn der Plan-LLM etwas technisch falsch oder unvollständig plant, korrigiere es direkt.
Frage gezielt nach wenn technische Details fehlen.
Du baust noch nichts — du planst und reviewst nur.
Nicht zu schnell aufgeben — erst alternative Wege suchen bevor du sagst "geht nicht".`;

const MAX_AUTO_REPLIES = 5;

let idCounter = 0;
function genId() {
  return `m-${++idCounter}-${Date.now()}`;
}

function extractQuestions(text: string, from: "plan" | "coder"): Question[] {
  const regex = /@user[\s:,]*([^@]*)/gi;
  const questions: Question[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const q = match[1].trim();
    if (q) {
      questions.push({
        id: genId(),
        from,
        text: q,
        timestamp: Date.now(),
        answered: false,
      });
    }
  }
  return questions;
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [projectMd, setProjectMd] = useState("");
  const [rightPanel, setRightPanel] = useState<"questions" | "project">("questions");
  const [streaming, setStreaming] = useState({ plan: false, coder: false });
  const [building, setBuilding] = useState(false);
  const [consumedBuilds, setConsumedBuilds] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<"plan" | "coder">("plan");
  const [planLlm, setPlanLlm] = useState(DEFAULT_PLAN);
  const [coderLlm, setCoderLlm] = useState(DEFAULT_CODER);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptName, setPromptName] = useState("");
  const [coderPrompt, setCoderPrompt] = useState(DEFAULT_CODER_PROMPT);
  const [coderPromptName, setCoderPromptName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoCountRef = useRef(0);
  const streamingRef = useRef({ plan: false, coder: false });
  const systemPromptRef = useRef("");
  const coderPromptRef = useRef(DEFAULT_CODER_PROMPT);
  const planLlmRef = useRef(DEFAULT_PLAN);
  const coderLlmRef = useRef(DEFAULT_CODER);

  useEffect(() => { systemPromptRef.current = systemPrompt; }, [systemPrompt]);
  useEffect(() => { coderPromptRef.current = coderPrompt; }, [coderPrompt]);
  useEffect(() => { planLlmRef.current = planLlm; }, [planLlm]);
  useEffect(() => { coderLlmRef.current = coderLlm; }, [coderLlm]);

  useEffect(() => {
    const savedPlanLlm = localStorage.getItem(STORAGE_KEY_PLAN_LLM);
    const savedCoderLlm = localStorage.getItem(STORAGE_KEY_CODER_LLM);
    if (savedPlanLlm && findOption(savedPlanLlm)) { setPlanLlm(savedPlanLlm); planLlmRef.current = savedPlanLlm; }
    if (savedCoderLlm && findOption(savedCoderLlm)) { setCoderLlm(savedCoderLlm); coderLlmRef.current = savedCoderLlm; }

    const saved = localStorage.getItem(STORAGE_KEY_PROMPT);
    const savedName = localStorage.getItem(STORAGE_KEY_PROMPT_NAME);
    const savedCoder = localStorage.getItem(STORAGE_KEY_CODER_PROMPT);
    const savedCoderName = localStorage.getItem(STORAGE_KEY_CODER_PROMPT_NAME);
    if (saved) { setSystemPrompt(saved); systemPromptRef.current = saved; }
    if (savedName) setPromptName(savedName);
    if (savedCoder) { setCoderPrompt(savedCoder); coderPromptRef.current = savedCoder; }
    if (savedCoderName) setCoderPromptName(savedCoderName);

    fetch("/api/conversation")
      .then((r) => r.json())
      .then((msgs: Omit<ChatMessage, "id">[]) =>
        setMessages(msgs.map((m) => ({ ...m, id: genId() })))
      )
      .catch(() => {});

    fetch("/api/project")
      .then((r) => r.json())
      .then((data) => setProjectMd(data.content))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function handleNewChat() {
    await fetch("/api/conversation", { method: "DELETE" });
    setMessages([]);
    setQuestions([]);
    autoCountRef.current = 0;
    setConsumedBuilds(new Set());
  }

  async function handleNewProject() {
    await Promise.all([
      fetch("/api/conversation", { method: "DELETE" }),
      fetch("/api/project", { method: "DELETE" }),
    ]);
    setMessages([]);
    setQuestions([]);
    autoCountRef.current = 0;
    setConsumedBuilds(new Set());
    const res = await fetch("/api/project");
    const data = await res.json();
    setProjectMd(data.content);
  }

  async function handleSaveProject(content: string) {
    await fetch("/api/project", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setProjectMd(content);
  }

  async function triggerProjectUpdate(responseText: string, role: "plan" | "coder") {
    const res = await fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responseText, role }),
    });
    const data = await res.json();
    if (data.updated) {
      const projRes = await fetch("/api/project");
      const projData = await projRes.json();
      setProjectMd(projData.content);
    }
  }

  function extractAllBuildPrompts(): string[] {
    const allContent = messages.map((m) => m.content).join("\n");
    const regex = /---RELAY_PROMPT_START---([\s\S]*?)---RELAY_PROMPT_END---/g;
    const prompts: string[] = [];
    let match;
    while ((match = regex.exec(allContent)) !== null) {
      const p = match[1].trim();
      if (p) prompts.push(p);
    }
    return prompts;
  }

  const allBuildPrompts = extractAllBuildPrompts();
  const pendingBuilds = allBuildPrompts.filter((_, i) => !consumedBuilds.has(i));
  const hasPrompts = allBuildPrompts.length > 0;
  const isMultiStep = allBuildPrompts.length > 1;

  function handleExportPrompt(index: number) {
    const prompt = allBuildPrompts[index];
    if (!prompt) return;
    const date = new Date().toISOString().slice(0, 10);
    const suffix = isMultiStep ? `-schritt-${index + 1}` : "";
    const blob = new Blob([prompt], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relay-prompt-${date}${suffix}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSplitSteps() {
    const prompt = allBuildPrompts[allBuildPrompts.length - 1];
    if (!prompt) return;

    const instruction = `Analysiere den folgenden Auftrag und teile ihn in kleine, testbare Schritte auf.
Jeder Schritt soll:
- Unabhängig baubar und testbar sein
- Maximal 1-2 Stunden Arbeit für Claude Code bedeuten
- Auf dem vorherigen Schritt aufbauen
Gib die Schritte nummeriert aus, jeder Schritt im RELAY_PROMPT Format (umschlossen mit ---RELAY_PROMPT_START--- und ---RELAY_PROMPT_END---).

Hier ist der Auftrag:

${prompt}`;

    autoCountRef.current = 0;
    setConsumedBuilds(new Set());
    const responseText = await streamResponse("plan", { content: instruction });
    await handleAutoRouting(responseText, "plan");
  }

  async function handleBuild(index: number) {
    const prompt = allBuildPrompts[index];
    if (!prompt) return;

    const label = isMultiStep ? `Schritt ${index + 1}` : "Claude Code";
    const confirmed = window.confirm(`${label} wird jetzt gebaut. Fortfahren?`);
    if (!confirmed) return;

    setConsumedBuilds((prev) => new Set(prev).add(index));
    setBuilding(true);

    const msgId = genId();
    setMessages((prev) => [...prev, { id: msgId, role: "coder", content: "", build: true }]);

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildPrompt: prompt,
          systemPrompt: coderPromptRef.current,
          model: findOption(coderLlmRef.current)?.model,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Build failed (${res.status})`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const data = line.replace(/^data: /, "");
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (typeof parsed === "string") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, content: m.content + parsed } : m
                )
              );
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch {
            // partial JSON chunk
          }
        }
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unbekannt";
      console.error("Build error:", errorMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && !m.content ? { ...m, content: `Build Fehler: ${errorMsg}` } : m
        )
      );
    } finally {
      setBuilding(false);
    }
  }

  function handlePromptUpload(content: string, fileName: string) {
    setSystemPrompt(content);
    setPromptName(fileName);
    localStorage.setItem(STORAGE_KEY_PROMPT, content);
    localStorage.setItem(STORAGE_KEY_PROMPT_NAME, fileName);
  }

  function handleCoderPromptUpload(content: string, fileName: string) {
    setCoderPrompt(content);
    setCoderPromptName(fileName);
    localStorage.setItem(STORAGE_KEY_CODER_PROMPT, content);
    localStorage.setItem(STORAGE_KEY_CODER_PROMPT_NAME, fileName);
  }

  function detectMentions(text: string): ("plan" | "coder")[] {
    const lower = text.toLowerCase();
    const result: ("plan" | "coder")[] = [];
    if (lower.includes("@plan")) result.push("plan");
    if (lower.includes("@coder")) result.push("coder");
    return result;
  }

  const streamResponse = useCallback(async function streamResponse(
    to: "plan" | "coder",
    opts: { content?: string; auto?: boolean } = {}
  ): Promise<string> {
    const { content, auto } = opts;
    const msgId = genId();

    if (content) {
      setMessages((prev) => [...prev, { id: genId(), role: "user", content, to }]);
    }

    setMessages((prev) => [...prev, { id: msgId, role: to, content: "", auto }]);
    setStreaming((prev) => ({ ...prev, [to]: true }));
    streamingRef.current = { ...streamingRef.current, [to]: true };

    let fullText = "";

    try {
      const prompt = to === "coder" ? coderPromptRef.current : systemPromptRef.current;
      const llmId = to === "coder" ? coderLlmRef.current : planLlmRef.current;
      const llmOption = findOption(llmId);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          to,
          systemPrompt: prompt,
          autoReply: auto,
          provider: llmOption?.provider,
          model: llmOption?.model,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const data = line.replace(/^data: /, "");
          if (data === "[DONE]") break;

          const parsed = JSON.parse(data);
          if (typeof parsed === "string") {
            fullText += parsed;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, content: m.content + parsed } : m
              )
            );
          } else if (parsed.error) {
            throw new Error(parsed.error);
          }
        }
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unbekannt";
      console.error(`Stream error (${to}):`, errorMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && !m.content ? { ...m, content: `Fehler: ${errorMsg}` } : m
        )
      );
    } finally {
      setStreaming((prev) => ({ ...prev, [to]: false }));
      streamingRef.current = { ...streamingRef.current, [to]: false };
    }

    return fullText;
  }, []);

  const handleAutoRouting = useCallback(async function handleAutoRouting(
    responseText: string,
    fromRole: "plan" | "coder"
  ) {
    const newQuestions = extractQuestions(responseText, fromRole);
    if (newQuestions.length > 0) {
      setQuestions((prev) => [...prev, ...newQuestions]);
    }

    triggerProjectUpdate(responseText, fromRole).catch(() => {});

    if (responseText.includes("---RELAY_PROMPT_START---") && responseText.includes("---RELAY_PROMPT_END---")) {
      setConsumedBuilds(new Set());
    }

    const mentions = detectMentions(responseText);
    const targets = mentions.filter((m) => m !== fromRole && !streamingRef.current[m]);

    if (targets.length === 0) return;

    const promises = targets.map(async (t) => {
      if (autoCountRef.current >= MAX_AUTO_REPLIES) return;
      autoCountRef.current++;
      const text = await streamResponse(t, { auto: true });
      await handleAutoRouting(text, t);
    });

    await Promise.all(promises);
  }, [streamResponse]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = inputRef.current?.value.trim();
    if (!text) return;

    inputRef.current!.value = "";
    autoCountRef.current = 0;

    const responseText = await streamResponse(target, { content: text });
    await handleAutoRouting(responseText, target);
  }

  const handleAnswerQuestion = useCallback(async function handleAnswerQuestion(
    questionId: string,
    answer: string
  ) {
    let replyTo: "plan" | "coder" = "plan";

    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId) {
          replyTo = q.from;
          return { ...q, answered: true, answer };
        }
        return q;
      })
    );

    autoCountRef.current = 0;
    const responseText = await streamResponse(replyTo, { content: answer });
    await handleAutoRouting(responseText, replyTo);
  }, [streamResponse, handleAutoRouting]);

  const isAnyStreaming = streaming.plan || streaming.coder;
  const unansweredCount = questions.filter((q) => !q.answered).length;

  return (
    <div className="flex h-screen">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header
          className="px-5 py-3 flex items-center justify-between backdrop-blur-xl sticky top-0 z-10"
          style={{ background: "color-mix(in srgb, var(--bg-primary) 85%, transparent)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Relay</h1>

            {isAnyStreaming && (
              <div className="flex items-center gap-2 ml-1">
                {streaming.plan && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--text-tertiary)" }} />
                    Plan
                  </span>
                )}
                {streaming.coder && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--indigo)" }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--indigo)" }} />
                    Coder
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={handleNewChat}
                disabled={isAnyStreaming || messages.length === 0}
                suppressHydrationWarning
                className="text-[12px] font-medium rounded-full px-3 py-1 transition-colors disabled:opacity-30"
                style={{ color: "var(--accent)" }}
              >
                Neuer Chat
              </button>
              <button
                type="button"
                onClick={handleNewProject}
                disabled={isAnyStreaming}
                className="text-[12px] font-medium rounded-full px-3 py-1 transition-colors disabled:opacity-30"
                style={{ color: "var(--red)" }}
              >
                Neues Projekt
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Plan LLM selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Plan</span>
              <select
                value={planLlm}
                onChange={(e) => {
                  setPlanLlm(e.target.value);
                  localStorage.setItem(STORAGE_KEY_PLAN_LLM, e.target.value);
                }}
                className="text-[12px] rounded-lg px-2 py-1 appearance-none cursor-pointer"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "none" }}
              >
                {PLAN_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <SystemPromptUpload label="Prompt" promptName={promptName} onUpload={handlePromptUpload} />
            </div>

            {/* Coder LLM selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--indigo)" }}>Coder</span>
              <select
                value={coderLlm}
                onChange={(e) => {
                  setCoderLlm(e.target.value);
                  localStorage.setItem(STORAGE_KEY_CODER_LLM, e.target.value);
                }}
                className="text-[12px] rounded-lg px-2 py-1 appearance-none cursor-pointer"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "none" }}
              >
                {CODER_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <SystemPromptUpload label="Prompt" promptName={coderPromptName || "Default"} onUpload={handleCoderPromptUpload} />
            </div>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4" style={{ background: "var(--bg-secondary)" }}>
          {messages.length === 0 && (
            <p className="text-center mt-24 text-[15px]" style={{ color: "var(--text-tertiary)" }}>
              Beschreib was du bauen willst.
            </p>
          )}
          {messages.map((msg) => (
            <Message key={msg.id} role={msg.role} content={msg.content} to={msg.to} auto={msg.auto} build={msg.build} />
          ))}
        </div>

        {/* Bottom bar */}
        <div className="px-5 py-3" style={{ background: "var(--bg-primary)", borderTop: "1px solid var(--border)" }}>
          {/* Build actions */}
          {hasPrompts && !building && (
            <div className="mb-3 space-y-2">
              {allBuildPrompts.map((_, i) => {
                const consumed = consumedBuilds.has(i);
                const stepLabel = isMultiStep ? `Schritt ${i + 1}` : null;
                return (
                  <div key={i} className="flex gap-2 items-center">
                    {stepLabel && (
                      <span className="text-[12px] font-medium w-16 shrink-0" style={{ color: consumed ? "var(--text-tertiary)" : "var(--text-secondary)" }}>
                        {stepLabel}
                      </span>
                    )}
                    {!consumed ? (
                      <button
                        type="button"
                        onClick={() => handleBuild(i)}
                        disabled={isAnyStreaming}
                        className="flex-1 rounded-xl px-3 py-2 text-[13px] text-white font-medium disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                        style={{ background: "var(--green)" }}
                      >
                        Build it
                      </button>
                    ) : (
                      <span className="flex-1 text-[12px] text-center" style={{ color: "var(--green)" }}>Gebaut</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExportPrompt(i)}
                      className="rounded-xl px-3 py-2 text-[12px] font-medium transition-colors"
                      style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                    >
                      Export
                    </button>
                  </div>
                );
              })}
              {!isMultiStep && (
                <button
                  type="button"
                  onClick={handleSplitSteps}
                  disabled={isAnyStreaming}
                  className="w-full rounded-xl px-3 py-2 text-[13px] font-medium disabled:opacity-40 transition-colors"
                  style={{ background: "var(--bg-tertiary)", color: "var(--accent)" }}
                >
                  In Schritte aufteilen
                </button>
              )}
            </div>
          )}

          {building && (
            <div className="mb-3 rounded-xl px-4 py-2.5 text-[13px] flex items-center gap-2" style={{ background: "var(--green-bg)", color: "var(--green)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--green)" }} />
              Build laeuft...
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Nachricht..."
                className="flex-1 rounded-xl px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="submit"
                className="rounded-xl px-5 py-2.5 text-[15px] font-medium text-white transition-all active:scale-[0.97]"
                style={{ background: "var(--accent)" }}
              >
                Senden
              </button>
            </div>

            {/* Segmented control */}
            <div className="flex mt-2 rounded-xl overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
              <button
                type="button"
                onClick={() => setTarget("plan")}
                className="flex-1 py-1.5 text-[13px] font-medium transition-all rounded-xl"
                style={{
                  background: target === "plan" ? "var(--bg-primary)" : "transparent",
                  color: target === "plan" ? "var(--text-primary)" : "var(--text-tertiary)",
                  boxShadow: target === "plan" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  margin: "2px",
                }}
              >
                An Plan
              </button>
              <button
                type="button"
                onClick={() => setTarget("coder")}
                className="flex-1 py-1.5 text-[13px] font-medium transition-all rounded-xl"
                style={{
                  background: target === "coder" ? "var(--bg-primary)" : "transparent",
                  color: target === "coder" ? "var(--indigo)" : "var(--text-tertiary)",
                  boxShadow: target === "coder" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  margin: "2px",
                }}
              >
                An Coder
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-80 shrink-0 flex flex-col" style={{ background: "var(--bg-secondary)", borderLeft: "1px solid var(--border)" }}>
        {/* Tab bar */}
        <div className="flex mx-3 mt-3 rounded-xl overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
          <button
            type="button"
            onClick={() => setRightPanel("questions")}
            className="flex-1 py-1.5 text-[12px] font-medium transition-all rounded-xl flex items-center justify-center gap-1"
            style={{
              background: rightPanel === "questions" ? "var(--bg-primary)" : "transparent",
              color: rightPanel === "questions" ? "var(--text-primary)" : "var(--text-tertiary)",
              boxShadow: rightPanel === "questions" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              margin: "2px",
            }}
          >
            Fragen
            {unansweredCount > 0 && (
              <span className="text-[10px] text-white rounded-full px-1.5 min-w-[1rem] text-center" style={{ background: "var(--red)" }}>
                {unansweredCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setRightPanel("project")}
            className="flex-1 py-1.5 text-[12px] font-medium transition-all rounded-xl"
            style={{
              background: rightPanel === "project" ? "var(--bg-primary)" : "transparent",
              color: rightPanel === "project" ? "var(--text-primary)" : "var(--text-tertiary)",
              boxShadow: rightPanel === "project" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              margin: "2px",
            }}
          >
            Projekt
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {rightPanel === "questions" ? (
            <QuestionPanel questions={questions} onAnswer={handleAnswerQuestion} />
          ) : (
            <ProjectPanel content={projectMd} onSave={handleSaveProject} />
          )}
        </div>
      </div>
    </div>
  );
}
