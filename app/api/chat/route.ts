import { NextRequest } from "next/server";
import { OllamaProvider } from "@/lib/providers/ollama";
import { BridgeProvider } from "@/lib/providers/bridge";
import { ChatProvider, Message } from "@/lib/providers/types";
import {
  readConversation,
  appendMessage,
  ConversationMessage,
} from "@/lib/conversation";
import { readProject } from "@/lib/project";

const CONTEXT_WINDOW = 10;

function getProvider(provider: string, model: string): ChatProvider {
  if (provider === "claude") {
    const bridgeUrl = process.env.BRIDGE_URL || "http://localhost:3010";
    return new BridgeProvider(bridgeUrl, model);
  }

  const baseUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  return new OllamaProvider(model, baseUrl);
}

function toProviderMessages(
  conversation: ConversationMessage[],
  projectContext: string
): Message[] {
  const result: Message[] = [];

  if (projectContext.trim()) {
    result.push({
      role: "user",
      content: `Hier ist der aktuelle Projektstand:\n\n${projectContext}`,
    });
    result.push({
      role: "assistant",
      content: "Verstanden, ich habe den Projektstand gelesen.",
    });
  }

  const recent = conversation.slice(-CONTEXT_WINDOW);

  for (const msg of recent) {
    const role = msg.role === "user" ? ("user" as const) : ("assistant" as const);
    const content =
      msg.role === "user"
        ? msg.content
        : `[${msg.role.toUpperCase()}]: ${msg.content}`;

    if (
      result.length > 0 &&
      result[result.length - 1].role === role &&
      role === "assistant"
    ) {
      result.push({ role: "user", content: "[Gespräch wird fortgesetzt]" });
    }

    result.push({ role, content });
  }

  return result;
}

export async function POST(request: NextRequest) {
  const {
    content,
    to,
    systemPrompt,
    autoReply,
    provider: providerName,
    model: modelName,
  } = (await request.json()) as {
    content?: string;
    to: "plan" | "coder";
    systemPrompt?: string;
    autoReply?: boolean;
    provider?: string;
    model?: string;
  };

  if (!autoReply && (!content || !to)) {
    return new Response(
      JSON.stringify({ error: "content and to required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    if (!autoReply && content) {
      await appendMessage({ role: "user", content, to });
    }

    const [conversation, projectMd] = await Promise.all([
      readConversation(),
      readProject(),
    ]);

    const messages = toProviderMessages(conversation, projectMd);

    const provider = getProvider(
      providerName || "ollama",
      modelName || "phi4:14b"
    );
    const generator = provider.chat(messages, systemPrompt || "");

    let fullResponse = "";

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await generator.next();
          if (done) {
            await appendMessage({ role: to, content: fullResponse });
            controller.enqueue("data: [DONE]\n\n");
            controller.close();
            return;
          }
          if (typeof value === "string") {
            fullResponse += value;
          }
          controller.enqueue(`data: ${JSON.stringify(value)}\n\n`);
        } catch (e) {
          if (fullResponse) {
            await appendMessage({ role: to, content: fullResponse });
          }
          const msg = e instanceof Error ? e.message : "Unknown error";
          controller.enqueue(`data: ${JSON.stringify({ error: msg })}\n\n`);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
