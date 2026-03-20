const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const knowledge = `
Products:
- MacBook Air M2: lightweight, best for students
- MacBook Pro M3: high performance
- iPhone 15 Pro: best camera & performance
- iPad Pro: for designers

Categories:
- MacBook
- iPhone
- iPad
- Accessories

Services:
- Product consultation
- Support
- Purchase guidance
`;
const systemPrompt = `
Recommend products based on:
- Budget
- Usage (student, office, editing, gaming)
- Performance needs

Explain:
- Why this product is good
- Keep explanation simple
- Suggest 2 options max

Answer FAQs:
- Warranty -> Official / store-based
- Delivery -> Available
- Products -> Apple devices + accessories

Keep answers:
- Short
- Clear
- Trust-building

When the user asks about warranty, delivery/shipping, or return/refund, use the store policy excerpts provided by the system.

Hard rules:
- Keep every response short (max ~35 words).
- Suggest exactly 2 options max.
- No extra paragraphs. Use this format only:
  Option 1: <product> - <reason>. Option 2: <product> - <reason>. Then: <one question>.
- Use Nepali Rupees (NPR). If the user mentions budget in USD ($), convert approximately (1 USD ~= 135 NPR) and refer only to NPR (do not show the $ value).
- Never invent future/unavailable models (example: "iPhone 17"). If asked, say you only recommend from your available lineup and ask budget/usage.
- Never include exact prices or price ranges. If price/availability/discount is requested, follow the name+contact template above.
- You may include the product page URL for recommended items. Do NOT invent URLs; only include a URL if you are confident it is correct. If unsure, omit the URL.
- Ask for name+contact ONLY when the user message contains at least one of these keywords: price, cost, available, discount, offer, warranty, delivery, shipping, return, refund, exchange. Otherwise do not ask for contact and do not mention "latest price/offers".
`;

const siteBaseUrl = process.env.SITE_BASE_URL || "https://macstore.com.np";

function extractPolicySentences(text) {
  const keywords = [
    "warranty",
    "guarantee",
    "delivery",
    "shipping",
    "ship",
    "return",
    "refund",
    "exchange",
    "replacement",
    "policy",
  ];
  const sentences = String(text)
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => keywords.some((k) => s.toLowerCase().includes(k)));
  return sentences.slice(0, 18).join(". ") + (sentences.length ? "." : "");
}

async function fetchAndExtract(pagePath) {
  const url = `${siteBaseUrl}${pagePath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "macstore-chatbot/1.0" },
      signal: controller.signal,
    });
    if (!r.ok) return "";
    let html = await r.text();
    html = html.slice(0, 250000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return extractPolicySentences(text);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function getStorePolicyContext(userMessage) {
  const m = String(userMessage || "").toLowerCase();
  const needsFaq = /(warranty|guarantee|faq|delivery|shipping|return|refund|exchange)/.test(m);
  if (!needsFaq) return "";

  const pagesToTry = [];
  pagesToTry.push("/faqs");
  if (/(delivery|shipping|ship)/.test(m)) pagesToTry.push("/shipping");
  if (/(return|refund|exchange)/.test(m)) pagesToTry.push("/return");

  const parts = [];
  for (const p of pagesToTry) {
    const snippet = await fetchAndExtract(p);
    if (snippet) parts.push(`${p}\n${snippet}`);
  }
  return parts.join("\n\n");
}

function stripContactIfNotRequested(userMessage, reply) {
  const m = String(userMessage || "").toLowerCase();
  const keywords = [
    "price",
    "cost",
    "available",
    "discount",
    "offer",
    "warranty",
    "delivery",
    "shipping",
    "return",
    "refund",
    "exchange",
  ];
  const wantsContact = keywords.some((k) => m.includes(k));
  if (wantsContact) return reply;

  let cleaned = String(reply || "");

  // Remove common “contact + latest price/offers” endings.
  cleaned = cleaned.replace(/Please share[^.?!\n]*\n?/gi, "");
  cleaned = cleaned.replace(/share your name and contact[^.?!\n]*[.?!]?/gi, "");
  cleaned = cleaned.replace(/name and contact[^.?!\n]*[.?!]?/gi, "");
  cleaned = cleaned.replace(/latest price[^.?!\n]*[.?!]?/gi, "");
  cleaned = cleaned.replace(/latest price and offers[^.?!\n]*[.?!]?/gi, "");
  cleaned = cleaned.replace(/offers[^.?!\n]*[.?!]?/gi, "");

  cleaned = cleaned
    .split("\n")
    .filter((line) => !/contact|name|price|offers/i.test(line))
    .join("\n")
    .trim();

  return cleaned || reply;
}

// CORS: required when the website is on another domain than this API (static hosting + separate API).
// Set e.g. CORS_ORIGIN=https://macstore.com.np,https://www.macstore.com.np
// Or CORS_ORIGIN=* for any origin (ok for this public chat endpoint; avoid if you add cookies later).
app.use((req, res, next) => {
  const raw = process.env.CORS_ORIGIN;
  if (raw) {
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const reqOrigin = req.headers.origin;
    if (list.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (reqOrigin && list.includes(reqOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", reqOrigin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

// Simple connectivity check for Groq API setup.
app.get("/api/health", async (_req, res) => {
  const hasApiKey = Boolean((process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.grok));
  try {
    if (!hasApiKey) {
      return res.status(500).json({
        ok: false,
        ai: "unconfigured",
        error: "Missing GROQ_API_KEY (or GROK_API_KEY/grok)",
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

  const groqApiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.grok);
  const groqModel = model || process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  if (!groqApiKey) {
    res.status(500).json({
      success: false,
      error: "Missing GROQ_API_KEY (or GROK_API_KEY/grok) in environment",
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const storePolicyContext = await getStorePolicyContext(message);

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
              systemPrompt +
              "\n\n" +
              knowledge +
              (storePolicyContext ? "\n\nStore policy excerpts:\n" + storePolicyContext : ""),
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

    const finalReply = stripContactIfNotRequested(message, reply);
    res.json({ success: true, reply: finalReply });
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

