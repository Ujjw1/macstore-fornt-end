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
- Product comparison: If the user asks to compare/choose between two products (compare, between, vs, “which is better”), still output exactly 2 options in the same format, and make each `<reason>` clearly highlight the key difference vs the other (focus on camera, performance, battery, portability, etc.). Do NOT mention exact prices.
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

function isEmiRequest(text) {
  var t = String(text || "").toLowerCase();
  return (
    t.indexOf("emi") !== -1 ||
    t.indexOf("installment") !== -1 ||
    t.indexOf("installments") !== -1 ||
    t.indexOf("monthly payment") !== -1 ||
    (t.indexOf("monthly") !== -1 && t.indexOf("emi") !== -1)
  );
}

function parseTenureMonths(text) {
  var t = String(text || "").toLowerCase();
  var m =
    t.match(/(\d{1,2})\s*(months?|mo)\b/) ||
    t.match(/(\d{1,2})\s*(years?|yr)\b/);

  if (!m) m = t.match(/\bemi\s*(\d{1,3})\b/);
  if (!m) return null;

  var n = parseInt(m[1], 10);
  if (isNaN(n)) return null;
  if (t.indexOf("year") !== -1 || t.indexOf("yr") !== -1) return n * 12;
  return n;
}

function extractNprNumber(text) {
  var t = String(text || "");

  // If it's already a plain number like "38500.00"
  var direct = t.trim().match(/^([0-9][0-9,]*)(?:\.[0-9]+)?$/);
  if (direct) {
    var rawDirect = String(direct[1]).replace(/,/g, "");
    var directN = parseInt(rawDirect, 10);
    return isNaN(directN) ? null : directN;
  }

  var m = t.match(/NPR\s*([0-9][0-9,]{2,})/i) || t.match(/Rs\.?\s*([0-9][0-9,]{2,})/i);
  if (!m) m = t.match(/([0-9][0-9,]{2,})\s*(NPR|Rs)\b/i);
  if (!m) return null;
  var raw = m[1] || m[0];
  raw = String(raw).replace(/,/g, "");
  var n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function formatNpr(n) {
  try {
    if (typeof n !== "number") return String(n);
    return n.toLocaleString("en-US");
  } catch {
    return String(n);
  }
}

async function fetchProductPriceFromSlug(slug) {
  if (!slug) return null;
  // Fetch from your existing backend product API (more reliable than scraping SPA HTML).
  var productApiBase = (process.env.PRODUCT_API_BASE || "https://admin.macstore.com.np/api").replace(/\/+$/g, "");
  var url = productApiBase + "/products/" + encodeURIComponent(slug);

  var controller = new AbortController();
  var timeout = setTimeout(function () {
    try {
      controller.abort();
    } catch (e) {}
  }, 8000);

  try {
    var r = await fetch(url, { method: "GET", signal: controller.signal });
    if (!r.ok) return null;
    var data = await r.json().catch(function () {
      return null;
    });
    var product = data && typeof data === "object" ? data.product : null;
    if (!product && Array.isArray(data)) product = data[0] || null;
    if (!product) return null;
    return extractNprNumber(product.price);
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getEmiContext(userMessage, page) {
  if (!isEmiRequest(userMessage)) return null;

  if (!page || page.type !== "product" || !page.slug) {
    return {
      reply:
        "To calculate EMI, please open a product page and ask EMI for that product (or tell me the product price in NPR + tenure months).",
    };
  }

  var tenureMonths = parseTenureMonths(userMessage) || 12;
  var principal = await fetchProductPriceFromSlug(page.slug);

  if (!principal) {
    return {
      reply:
        "EMI calculation: please share the product price (NPR) and tenure (e.g., 12 months).",
    };
  }

  var monthly = Math.round(principal / tenureMonths);
  return {
    reply:
      "EMI estimate for " +
      page.name +
      " (approx, no-interest, using listed price). " +
      tenureMonths +
      " months: Monthly ~ NPR " +
      formatNpr(monthly) +
      ". Want a different tenure (6/12/18/24 months)?",
  };
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
  const page = req.body && req.body.page ? req.body.page : null;

  if (!userId || !message) {
    res.status(400).json({
      success: false,
      error: "Missing required fields: userId and message",
    });
    return;
  }

  const groqApiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.grok);
  const groqModel = model || process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const storePolicyContext = await getStorePolicyContext(message);

    const pageContext =
      page && page.type === "product" && page.name
        ? `User is viewing product page: ${page.name}. Focus recommendations on related variants/accessories of this product family.`
        : "";

    const emiContext = await getEmiContext(message, page);
    if (emiContext && emiContext.reply) {
      return res.status(200).json({ success: true, reply: emiContext.reply });
    }

    if (!groqApiKey) {
      res.status(200).json({
        success: true,
        reply:
          "I can’t connect to AI right now. Please tell your budget (NPR) and usage (student/office/editing/gaming), and which product you want (iPhone/MacBook/iPad/accessories).",
      });
      return;
    }

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
              "\n\nProduct links should use this base URL:\n" +
              siteBaseUrl +
              "\n(Use paths like /productview/...; do not invent slugs.)" +
              (pageContext ? "\n\n" + pageContext : "") +
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

// POST /api/chat/stream
// SSE streaming endpoint for the Groq OpenAI-compatible API.
app.post("/api/chat/stream", async (req, res) => {
  const userId = req.body && req.body.userId ? String(req.body.userId) : null;
  const message = req.body && req.body.message ? String(req.body.message) : null;
  const model = req.body && req.body.model ? String(req.body.model) : null;
  const page = req.body && req.body.page ? req.body.page : null;

  if (!userId || !message) {
    res.status(400).json({
      success: false,
      error: "Missing required fields: userId and message",
    });
    return;
  }

  const groqApiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.grok);
  const groqModel = model || process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const emiContext = await getEmiContext(message, page);
    if (emiContext && emiContext.reply) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders && res.flushHeaders();

      var payload = {
        choices: [{ delta: { content: emiContext.reply } }],
      };
      res.write("data: " + JSON.stringify(payload) + "\n\n");
      res.write("data: [DONE]\n\n");
      clearTimeout(timeout);
      res.end();
      return;
    }

    if (!groqApiKey) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders && res.flushHeaders();

      var payload = {
        choices: [
          {
            delta: {
              content:
                "I can’t connect to AI right now. Please tell your budget (NPR) and usage (student/office/editing/gaming), and which product you want (iPhone/MacBook/iPad/accessories).",
            },
          },
        ],
      };
      res.write("data: " + JSON.stringify(payload) + "\n\n");
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const storePolicyContext = await getStorePolicyContext(message);

    const pageContext =
      page && page.type === "product" && page.name
        ? `User is viewing product page: ${page.name}. Focus recommendations on related variants/accessories of this product family.`
        : "";

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
              "\n\nProduct links should use this base URL:\n" +
              siteBaseUrl +
              "\n(Use paths like /productview/...; do not invent slugs.)" +
              (pageContext ? "\n\n" + pageContext : "") +
              (storePolicyContext ? "\n\nStore policy excerpts:\n" + storePolicyContext : ""),
          },
          { role: "user", content: message },
        ],
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      res.status(r.status).json({
        success: false,
        error: t || `Groq error (HTTP ${r.status})`,
      });
      return;
    }

    // Forward SSE to browser.
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders && res.flushHeaders();

    const reader = r.body && r.body.getReader ? r.body.getReader() : null;
    if (!reader) {
      res.end();
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    // If we already started streaming, just end the connection.
    try {
      res.end();
    } catch {}
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

