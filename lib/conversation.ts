import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface ConversationMessage {
  role: "user" | "plan" | "coder";
  content: string;
  to?: "plan" | "coder";
}

const DATA_DIR = path.join(process.cwd(), "data");
const CONVERSATION_FILE = path.join(DATA_DIR, "conversation.json");

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function readConversation(): Promise<ConversationMessage[]> {
  await ensureDataDir();
  if (!existsSync(CONVERSATION_FILE)) return [];
  const raw = await readFile(CONVERSATION_FILE, "utf-8");
  return JSON.parse(raw);
}

export async function writeConversation(messages: ConversationMessage[]): Promise<void> {
  await ensureDataDir();
  await writeFile(CONVERSATION_FILE, JSON.stringify(messages, null, 2), "utf-8");
}

let writeLock = Promise.resolve();

export function appendMessage(msg: ConversationMessage): Promise<ConversationMessage[]> {
  const op = writeLock.then(async () => {
    const messages = await readConversation();
    messages.push(msg);
    await writeConversation(messages);
    return messages;
  });
  writeLock = op.then(() => {}, () => {});
  return op;
}

export async function clearConversation(): Promise<void> {
  await ensureDataDir();
  await writeFile(CONVERSATION_FILE, "[]", "utf-8");
}
