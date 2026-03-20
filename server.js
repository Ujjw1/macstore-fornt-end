const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: "1mb" }));

// Simple connectivity check for Groq API setup.
app.get("/api/health", async (_req, res) => {
  const hasApiKey = Boolean(process.env.GROQ_API_KEY);
  try {
    if (!hasApiKey) {
      return res.status(500).json({
        ok: false,
        ai: "unconfigured",
        error: "Missing GROQ_API_KEY",
      });
    }
    return res.json({
      ok: true,
      ai: "groq-configured",
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      ai: "error",
      error: e && e.message ? e.message : String(e),
    });
  }
});

// POST /api/chat
// Expects: { userId: string, message: string, model?: string }
// Calls Groq chat completions API.
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

  const groqApiKey = process.env.GROQ_API_KEY;
  const groqModel = model || process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  if (!groqApiKey) {
    res.status(500).json({
      success: false,
      error: "Missing GROQ_API_KEY in environment",
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant for an Apple store in Nepal. Help users choose products.",
          },
          { role: "user", content: message },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

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
        error: data?.error?.message || data?.error || `Groq error (HTTP ${r.status})`,
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
    const msg = e && e.message ? e.message : String(e);
    res.status(502).json({
      success: false,
      error: `AI server error: ${msg}`,
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

