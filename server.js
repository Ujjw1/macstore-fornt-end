const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: "1mb" }));

// POST /api/chat
// Expects: { userId: string, message: string, model?: string }
// Calls local Ollama-compatible server: http://localhost:11434/api
app.post("/api/chat", async (req, res) => {
  const userId = req.body && req.body.userId ? String(req.body.userId) : null;
  const message = req.body && req.body.message ? String(req.body.message) : null;
  const model = req.body && req.body.model ? String(req.body.model) : null;

  if (!userId || !message) {
    res.status(400).json({
      success: false,
      error: "Missing required fields: userId and message",
    });
    return;
  }

  const ollamaApiBase = process.env.OLLAMA_API_BASE || "http://localhost:11434/api";
  const ollamaModel = model || process.env.OLLAMA_MODEL || "deepseek-r1";

  try {
    const r = await fetch(`${ollamaApiBase}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [{ role: "user", content: message }],
        stream: false,
      }),
    });

    const text = await r.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    const reply =
      data?.message?.content ||
      data?.response ||
      data?.output ||
      data?.choices?.[0]?.message?.content ||
      null;

    if (!r.ok) {
      res.status(r.status).json({
        success: false,
        error: data?.error || `Ollama error (HTTP ${r.status})`,
      });
      return;
    }

    if (!reply) {
      res.status(502).json({
        success: false,
        error: "AI runtime returned an empty reply",
      });
      return;
    }

    res.json({ success: true, reply });
  } catch (e) {
    res.status(502).json({
      success: false,
      error: "Ollama server not responding",
    });
  }
});

// Serve the static frontend
app.use(express.static(path.join(__dirname)));

// SPA fallback (so client-side routes keep working)
app.use((req, res) => {
  // Keep API behavior predictable: non-existing API endpoints return JSON.
  if (String(req.path || "").startsWith("/api/")) {
    res.status(404).json({ success: false, error: "Not found" });
    return;
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${PORT}`);
});

