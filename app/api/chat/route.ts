import { NextRequest, NextResponse } from "next/server";
import { AnthropicProvider } from "@/lib/providers/anthropic";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { Message } from "@/lib/providers/types";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const { messages } = (await request.json()) as { messages: Message[] };
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const provider = new AnthropicProvider(apiKey);

  let text = "";
  for await (const chunk of provider.chat(messages, SYSTEM_PROMPT)) {
    text += chunk;
  }

  return NextResponse.json({ role: "assistant", content: text });
}
