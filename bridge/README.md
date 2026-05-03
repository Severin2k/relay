# Relay Bridge

Bridge zwischen Relay und Claude Code CLI. Ruft `claude -p` auf und streamt die Antwort als SSE zurück.

## Starten

```bash
cd bridge
npm start
```

Läuft auf `http://localhost:3010`.

## API

**POST /chat**

```json
{
  "messages": [
    { "role": "user", "content": "Hallo" }
  ],
  "systemPrompt": "Optional"
}
```

Antwort: SSE Stream (gleiche Struktur wie Relay's Ollama-Provider).

## Voraussetzung

`claude` CLI muss installiert und eingeloggt sein.
