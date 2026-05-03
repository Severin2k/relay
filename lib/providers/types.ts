export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatProvider {
  chat(messages: Message[], systemPrompt: string): AsyncGenerator<string>;
}
