import { ChatProvider, Message } from "./types";

export class BridgeProvider implements ChatProvider {
  private baseUrl: string;
  private model?: string;
  private endpoint: string;

  constructor(baseUrl = "http://localhost:3010", model?: string, endpoint = "/chat") {
    this.baseUrl = baseUrl;
    this.model = model;
    this.endpoint = endpoint;
  }

  async *chat(messages: Message[], systemPrompt: string): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}${this.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, systemPrompt, model: this.model }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bridge error ${res.status}: ${text}`);
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
        if (data === "[DONE]") return;

        const parsed = JSON.parse(data);
        if (typeof parsed === "string") {
          yield parsed;
        } else if (parsed.error) {
          throw new Error(parsed.error);
        }
      }
    }
  }
}
