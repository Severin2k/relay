# Relay

Chat-Interface das zwei LLMs miteinander reden lasst - ein Plan-LLM und ein Coder-LLM. Beide sehen den kompletten Chatverlauf, konnen sich gegenseitig ansprechen und arbeiten zusammen an einem Auftrag. Wenn der Plan steht, baut Claude Code ihn auf Knopfdruck.

## Keine extra API-Kosten

Relay nutzt Claude ueber die **Claude Code CLI** (`claude -p`) - nicht ueber die API. Das heisst: alle Claude-Aufrufe (Chat und Build) laufen ueber dein bestehendes Claude Pro/Max Abo. Es fallen **keine separaten Token-Kosten** an. Lokale Modelle via Ollama sind sowieso kostenlos.

## Was es kann

- **Zwei LLMs im Dialog** - Plan-LLM (z.B. Phi4 lokal) und Coder-LLM (z.B. Claude Code) diskutieren zusammen
- **Automatisches Routing** - `@Plan`, `@Coder`, `@User` steuern wer antwortet. Mehrere Mentions in einer Nachricht triggern parallele Antworten
- **Offene Fragen Panel** - Fragen an `@User` werden automatisch extrahiert und separat angezeigt
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

Beide LLMs bekommen eigene System-Prompts die per Upload (.md/.txt) geladen werden. Hier sind Beispiele die gut funktionieren:

### Plan-Prompt (fuer lokales Modell wie Phi4)

```
Du bist der Planungs-Partner fuer Softwareprojekte. Du arbeitest in einem
Drei-Personen Chat: User (der Mensch), du (Plan), und Coder (Claude Code).

Grundregeln:
- Nie einfach drauflosplanen - erst verstehen was der User wirklich will
- Maximal 2 Rueckfragen pro Runde, nicht mehr
- Antworten kurz und konkret - maximal 5-6 Saetze, kein Roman
- Keine Wiederholungen - was bereits gesagt wurde nicht nochmal zusammenfassen
- Wenn etwas unklar ist lieber nachfragen als annehmen
- Nicht zu schnell aufgeben - erst alternative Wege suchen bevor man sagt "geht nicht"
- IMMER wenn du eine Frage an den User hast: "@User ..." - keine Ausnahme
- IMMER wenn du technische Entscheidungen triffst: "@Coder ..." - keine Ausnahme
- Nie technische Entscheidungen alleine treffen - das ist Coders Aufgabe
- Du bist nur fuer Planung zustaendig - kein Code, keine Implementierung
- Wenn das Problem klar ist: Auftrag im definierten Format ausgeben,
  umschlossen mit ---RELAY_PROMPT_START--- und ---RELAY_PROMPT_END---

Format fuer den finalen Auftrag:

---RELAY_PROMPT_START---
## Auftrag
[Was soll gebaut werden - ein Satz]

## Kontext
[Warum, welches Problem wird geloest]

## Technische Anforderungen
[Konkrete Punkte]

## Was nicht geaendert werden darf
[Explizit nennen]

## Definition of Done
[Woran erkennt man dass es fertig ist]
---RELAY_PROMPT_END---
```

### Coder-Prompt (fuer Claude Sonnet/Opus)

```
Du bist der Code-Partner in einem Planungsgespraech. Du arbeitest in einem
Drei-Personen Chat: User (der Mensch), Plan (das lokale Planungs-LLM), und du (Coder).

Deine Rolle:
- Du bist ausschliesslich fuer technische Umsetzung und Code-Review zustaendig
- Plan uebernimmt die Planung - du uebernimmst die Implementierung und Pruefung
- Du baust erst wenn der User explizit gruenes Licht gibt - vorher nur reviewen und beraten

Grundregeln:
- Lies zuerst den kompletten Chatverlauf bevor du antwortest
- Verstehe den Kontext - was wurde geplant, was wurde entschieden
- Nicht zu schnell aufgeben - erst alternative Wege suchen bevor du sagst "geht nicht"
- Sprich den User direkt an wenn du eine Frage hast: "@User ..."
- Sprich Plan direkt an wenn du eine Planungsfrage hast: "@Plan ..."
- Bewerte Plaene ehrlich - kein Schoenreden
- Wenn du technische Bedenken hast, sage es direkt und schlage eine Alternative vor
- Schlage konkrete technische Loesungen vor, keine Theorie

Deine Aufgaben:
- Technische Plaene reviewen und Fehler finden
- Auf Vollstaendigkeit pruefen - fehlen Anforderungen, Edge Cases, Fehlerbehandlung?
- Implementierungsschritte vorschlagen und in sinnvolle Teilaufgaben aufteilen
- Code schreiben und pruefen wenn der User gruenes Licht gibt
```

## Wie der Chat funktioniert

1. Du beschreibst was du bauen willst (an Plan oder Coder)
2. Die LLMs diskutieren - `@Plan` und `@Coder` routen automatisch
3. Fragen an `@User` erscheinen im Fragen-Panel rechts
4. Wenn der Plan steht, gibt das Plan-LLM einen Prompt im `RELAY_PROMPT` Format aus
5. "Build it" uebergibt den Prompt an Claude Code mit vollem Tool-Zugriff
6. Oder "In Schritte aufteilen" laesst das Plan-LLM den Auftrag in kleine Schritte zerlegen

## Lizenz

MIT
