const http = require("http");
const { spawn } = require("child_process");

const PORT = 3010;

function buildPrompt(messages) {
  return messages
    .map((m) => (m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`))
    .join("\n\n");
}

function streamClaude(args, res) {
  console.log("Spawning claude with args:", args.slice(0, 3).join(" "), "...");
  const child = spawn("claude", args);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    res.write(`data: ${JSON.stringify(text)}\n\n`);
  });

  child.stderr.on("data", (chunk) => {
    console.error("claude stderr:", chunk.toString());
  });

  child.on("close", (code, signal) => {
    console.log("claude closed, code:", code, "signal:", signal);
    if (code !== 0) {
      res.write(`data: ${JSON.stringify({ error: `claude exited with code ${code}, signal ${signal}` })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });

  child.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });

  res.on("close", () => {
    if (!child.killed) {
      child.kill();
    }
  });
}

function parseBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      callback(null, JSON.parse(body));
    } catch {
      callback(new Error("Invalid JSON"));
    }
  });
}

function handleChat(req, res) {
  parseBody(req, (err, parsed) => {
    if (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const { messages, systemPrompt, model } = parsed;
    if (!messages || !Array.isArray(messages)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "messages array required" }));
      return;
    }

    const prompt = buildPrompt(messages);
    const args = ["-p", prompt];

    if (model) {
      args.push("--model", model);
    }

    args.push("--allowedTools", "");

    if (systemPrompt) {
      args.push("--append-system-prompt", systemPrompt);
    }

    streamClaude(args, res);
  });
}

function handleBuild(req, res) {
  parseBody(req, (err, parsed) => {
    if (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const { buildPrompt: prompt, systemPrompt, model } = parsed;
    if (!prompt) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "buildPrompt required" }));
      return;
    }

    const args = ["-p", prompt];

    if (model) {
      args.push("--model", model);
    }

    if (systemPrompt) {
      args.push("--append-system-prompt", systemPrompt);
    }

    console.log("BUILD MODE - full tool access, model:", model || "default");
    streamClaude(args, res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    handleChat(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/build") {
    handleBuild(req, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Relay Bridge running on http://localhost:${PORT}`);
});
