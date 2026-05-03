import { readConversation, clearConversation } from "@/lib/conversation";

export async function GET() {
  const messages = await readConversation();
  return Response.json(messages);
}

export async function DELETE() {
  await clearConversation();
  return Response.json({ ok: true });
}
