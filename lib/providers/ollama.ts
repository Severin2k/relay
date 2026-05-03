import { ChatProvider, Message } from "./types";

export class OllamaProvider implements ChatProvider {
  private baseUrl: string;
  private model: string;

  constructor(model = "llama3.2", baseUrl = "http://localhost:11434") {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async *chat(messages: Message[], systemPrompt: string): AsyncGenerator<string> {
    const ollamaMessages = [];

    if (systemPrompt) {
      ollamaMessages.push({ role: "system", content: systemPrompt });
    }

    for (const m of messages) {
      ollamaMessages.push({ role: m.role, content: m.content });
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield data.message.content;
        }
      }
    }
  }
}
