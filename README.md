# Relay

Chat-Interface das zwei LLMs miteinander reden lasst - ein Plan-LLM und ein Coder-LLM. Beide sehen den kompletten Chatverlauf, konnen sich gegenseitig ansprechen und arbeiten zusammen an einem Auftrag. Wenn der Plan steht, baut Claude Code ihn auf Knopfdruck.

## Was es kann

- **Zwei LLMs im Dialog** - Plan-LLM (z.B. Phi4 lokal) und Coder-LLM (z.B. Claude Code) diskutieren zusammen
- **Automatisches Routing** - `@Plan`, `@Coder`, `@Severin` steuern wer antwortet. Mehrere Mentions in einer Nachricht triggern parallele Antworten
- **Offene Fragen Panel** - Fragen an `@Severin` werden automatisch extrahiert und separat angezeigt
- **Projekt-Kontext** - `project.md` halt Entscheidungen fest, beide LLMs bekommen sie als Kontext statt den ganzen Chatverlauf
- **Build it** - Fertiger Prompt zwischen `---RELAY_PROMPT_START---` / `---RELAY_PROMPT_END---` kann direkt an Claude Code mit vollem Tool-Zugriff uebergeben werden
- **In Schritte aufteilen** - Plan-LLM zerlegt grosse Auftraege in kleine testbare Schritte, jeder mit eigenem Build-Button
- **Export** - Prompts als `.md` Datei herunterladen
- **LLM-Auswahl** - Plan und Coder separat waehlbar: Ollama (phi4, gemma3, qwen3) oder Claude (Sonnet, Opus)

## Voraussetzungen

- **Node.js** >= 18
- **Ollama** laufend mit mindestens einem Modell (z.B. `ollama pull phi4:14b`)
- **Claude Code CLI** installiert und authentifiziert (`claude` muss im PATH sein)

## Installation

```bash
git clone https://github.com/Severin2k/relay.git
cd relay
npm install
```

## Konfiguration

`.env.local` anlegen:

```env
# Ollama
OLLAMA_URL=http://localhost:11434

# Bridge (optional, default localhost:3010)
BRIDGE_URL=http://localhost:3010

# Dev Origins (deine IP wenn nicht ueber localhost zugreifst)
ALLOWED_DEV_ORIGINS=192.168.1.100
```

## Starten

Zwei Prozesse - Bridge und Next.js:

```bash
# Terminal 1: Bridge Server (verbindet Claude Code CLI)
cd bridge
node server.js

# Terminal 2: Next.js Frontend
npm run dev
```

Dann im Browser `http://localhost:3000` oeffnen.

## Aufbau

```
relay/
  app/
    api/
      chat/       POST - Chat mit LLM (Ollama oder Claude via Bridge)
      build/      POST - Build mit vollem Claude Code Zugriff
      conversation/ GET/DELETE - Chatverlauf lesen/loeschen
      project/    GET/PUT/POST/DELETE - Projektstand
    page.tsx      Hauptseite
  bridge/
    server.js     HTTP Server, spawnt claude -p
  components/
    chat.tsx      Haupt-Chat mit Routing, Streaming, Build
    message.tsx   Nachricht-Darstellung (Plan/Coder/Build)
    question-panel.tsx  Offene Fragen Sidebar
    project-panel.tsx   Projektstand Sidebar
    system-prompt-upload.tsx  Prompt-Upload
  lib/
    conversation.ts  Lesen/Schreiben von data/conversation.json
    project.ts       Lesen/Schreiben von data/project.md
    llm-options.ts   Modell-Definitionen
    providers/
      ollama.ts      Ollama API Provider
      bridge.ts      Bridge Provider (Claude CLI)
      types.ts       ChatProvider Interface
  data/
    conversation.json  Gemeinsamer Chatverlauf
    project.md         Projektstand (Entscheidungen, offene Punkte)
```

## System-Prompts

Beide LLMs bekommen eigene System-Prompts die per Upload (.md/.txt) geladen werden:

- **Plan-Prompt** - Steuert wie das Plan-LLM arbeitet. Beispiel liegt in `system-prompt.md`
- **Coder-Prompt** - Steuert wie das Coder-LLM reviewt. Hat einen Default der auf Code-Review fokussiert ist

## Wie der Chat funktioniert

1. Du beschreibst was du bauen willst (an Plan oder Coder)
2. Die LLMs diskutieren - `@Plan` und `@Coder` routen automatisch
3. Fragen an `@Severin` erscheinen im Fragen-Panel rechts
4. Wenn der Plan steht, gibt das Plan-LLM einen Prompt im `RELAY_PROMPT` Format aus
5. "Build it" uebergibt den Prompt an Claude Code mit vollem Tool-Zugriff
6. Oder "In Schritte aufteilen" laesst das Plan-LLM den Auftrag in kleine Schritte zerlegen

## Lizenz

MIT
