import Anthropic from "@anthropic-ai/sdk";
import { ChatProvider, Message } from "./types";

export class AnthropicProvider implements ChatProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-20250514") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async *chat(messages: Message[], systemPrompt: string): AsyncGenerator<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    for (const block of response.content) {
      if (block.type === "text") {
        yield block.text;
      }
    }
  }
}
