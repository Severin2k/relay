import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECT_FILE = path.join(DATA_DIR, "project.md");

const TEMPLATE = `# Projekt: Neues Projekt

## Entschieden


## Offen


## Nächste Schritte


## Technischer Stack

`;

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function readProject(): Promise<string> {
  await ensureDataDir();
  if (!existsSync(PROJECT_FILE)) {
    await writeFile(PROJECT_FILE, TEMPLATE, "utf-8");
    return TEMPLATE;
  }
  return readFile(PROJECT_FILE, "utf-8");
}

export async function writeProject(content: string): Promise<void> {
  await ensureDataDir();
  await writeFile(PROJECT_FILE, content, "utf-8");
}

export async function resetProject(): Promise<void> {
  await writeProject(TEMPLATE);
}

const DECISION_PATTERNS = [
  /\b(entschieden|festgelegt|bestätigt|beschlossen)\b/i,
  /\b(wir (verwenden|nutzen|nehmen|machen|bauen|setzen auf))\b/i,
  /\b(sieht gut aus|machen wir so|einverstanden|passt|korrekt)\b/i,
  /\b(gewählt|ausgewählt|festgelegt auf)\b/i,
  /\b(statt|anstatt|lieber|besser als)\b/i,
];

const OPEN_PATTERNS = [
  /\b(noch (offen|unklar|zu klären))\b/i,
  /\b(müssen wir noch|sollten wir noch)\b/i,
  /\b(@user)\b/i,
];

const NEXT_STEP_PATTERNS = [
  /\b(nächster schritt|als nächstes|todo|danach)\b/i,
  /\b(zuerst|dann|anschließend)\b/i,
];

const STACK_PATTERNS = [
  /\b(framework|datenbank|sprache|library|tool|api|sdk|runtime)\b/i,
  /\b(next\.?js|react|node|typescript|python|postgres|sqlite|redis|docker)\b/i,
  /\b(tailwind|prisma|drizzle|medusa|stripe|paypal)\b/i,
];

function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.length < 500);
}

function matchesAny(sentence: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(sentence));
}

function addToSection(md: string, section: string, items: string[]): string {
  if (items.length === 0) return md;

  const sectionHeader = `## ${section}`;
  const idx = md.indexOf(sectionHeader);
  if (idx === -1) return md;

  const afterHeader = idx + sectionHeader.length;
  const nextSection = md.indexOf("\n## ", afterHeader);
  const sectionEnd = nextSection === -1 ? md.length : nextSection;
  const existingContent = md.slice(afterHeader, sectionEnd);

  const newItems = items.filter((item) => !existingContent.includes(item));
  if (newItems.length === 0) return md;

  const insertion = newItems.map((i) => `- ${i}`).join("\n");
  const before = md.slice(0, sectionEnd).trimEnd();
  const after = md.slice(sectionEnd);

  return before + "\n" + insertion + "\n" + after;
}

let updateLock = Promise.resolve();

export function updateProjectFromResponse(
  responseText: string,
  _role: "plan" | "coder"
): Promise<boolean> {
  const op = updateLock.then(async () => {
    const sentences = extractSentences(responseText);
    if (sentences.length === 0) return false;

    const decisions: string[] = [];
    const open: string[] = [];
    const nextSteps: string[] = [];
    const stack: string[] = [];

    for (const s of sentences) {
      const clean = s.replace(/^[-*•]\s*/, "").replace(/\n/g, " ");
      if (matchesAny(s, DECISION_PATTERNS)) decisions.push(clean);
      if (matchesAny(s, OPEN_PATTERNS)) open.push(clean);
      if (matchesAny(s, NEXT_STEP_PATTERNS)) nextSteps.push(clean);
      if (matchesAny(s, STACK_PATTERNS) && matchesAny(s, DECISION_PATTERNS))
        stack.push(clean);
    }

    if (
      decisions.length === 0 &&
      open.length === 0 &&
      nextSteps.length === 0 &&
      stack.length === 0
    )
      return false;

    let md = await readProject();
    md = addToSection(md, "Entschieden", decisions);
    md = addToSection(md, "Offen", open);
    md = addToSection(md, "Nächste Schritte", nextSteps);
    md = addToSection(md, "Technischer Stack", stack);
    await writeProject(md);
    return true;
  });

  updateLock = op.then(
    () => {},
    () => {}
  );
  return op;
}
