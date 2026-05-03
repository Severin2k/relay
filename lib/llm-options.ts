export interface LlmOption {
  id: string;
  label: string;
  provider: "ollama" | "claude";
  model: string;
}

export const ALL_OPTIONS: LlmOption[] = [
  { id: "ollama-phi4", label: "Ollama (phi4:14b)", provider: "ollama", model: "phi4:14b" },
  { id: "ollama-gemma3", label: "Ollama (gemma3:12b)", provider: "ollama", model: "gemma3:12b" },
  { id: "ollama-qwen3", label: "Ollama (qwen3:8b)", provider: "ollama", model: "qwen3:8b" },
  { id: "claude-sonnet", label: "Claude Sonnet", provider: "claude", model: "sonnet" },
  { id: "claude-opus", label: "Claude Opus", provider: "claude", model: "opus" },
];

export const PLAN_OPTIONS = ALL_OPTIONS;

export const CODER_OPTIONS: LlmOption[] = [
  ALL_OPTIONS[3], // Claude Sonnet
  ALL_OPTIONS[4], // Claude Opus
  ALL_OPTIONS[0], // Ollama phi4
];

export const DEFAULT_PLAN = "ollama-phi4";
export const DEFAULT_CODER = "claude-sonnet";

export function findOption(id: string): LlmOption | undefined {
  return ALL_OPTIONS.find((o) => o.id === id);
}
