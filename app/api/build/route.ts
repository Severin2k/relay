import { NextRequest } from "next/server";
import { appendMessage } from "@/lib/conversation";
import { readProject } from "@/lib/project";

export async function POST(request: NextRequest) {
  const { buildPrompt, systemPrompt, model } = (await request.json()) as {
    buildPrompt: string;
    systemPrompt?: string;
    model?: string;
  };

  if (!buildPrompt) {
    return new Response(
      JSON.stringify({ error: "buildPrompt required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const projectMd = await readProject();

    const fullPrompt = projectMd.trim()
      ? `Hier ist der aktuelle Projektstand:\n\n${projectMd}\n\n---\n\n${buildPrompt}`
      : buildPrompt;

    await appendMessage({ role: "user", content: `[BUILD]: ${buildPrompt}`, to: "coder" });

    const bridgeUrl = process.env.BRIDGE_URL || "http://localhost:3010";
    const bridgeRes = await fetch(`${bridgeUrl}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildPrompt: fullPrompt, systemPrompt, model }),
    });

    if (!bridgeRes.ok) {
      const text = await bridgeRes.text();
      throw new Error(`Bridge error ${bridgeRes.status}: ${text}`);
    }

    const bridgeReader = bridgeRes.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await bridgeReader.read();
        if (done) {
          await appendMessage({ role: "coder", content: fullResponse });
          controller.enqueue("data: [DONE]\n\n");
          controller.close();
          return;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n").filter(Boolean);

        for (const line of lines) {
          const data = line.replace(/^data: /, "");
          if (data === "[DONE]") {
            await appendMessage({ role: "coder", content: fullResponse });
            controller.enqueue("data: [DONE]\n\n");
            controller.close();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (typeof parsed === "string") {
              fullResponse += parsed;
            }
          } catch {
            // partial chunk, pass through
          }
          controller.enqueue(`${line}\n\n`);
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
    console.error("Build API error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
