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
- Never invent future/unavailable models (example: "iPhone 17"). If asked, say we only recommend from available lineup and ask budget/usage.
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
    html = html.slice(0, 250000); // avoid huge pages
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

  // Only these pages per your requirement.
  // - FAQs (warranty/support/delivery related)
  // - Shipping (delivery)
  // - Return (refund/exchange)
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

  // Remove the common contact/price-request phrasing.
  cleaned = cleaned.replace(/Please share[^.?!\n]*\n?/gi, "");
  cleaned = cleaned.replace(/share your name and contact[^.?!\n]*[.?!]?/gi, "");
  cleaned = cleaned.replace(/name and contact[^.?!\n]*[.?!]?/gi, "");
  cleaned = cleaned.replace(/latest price[^.?!\n]*[.?!]?/gi, "");
  cleaned = cleaned.replace(/latest price and offers[^.?!\n]*[.?!]?/gi, "");
  cleaned = cleaned.replace(/offers[^.?!\n]*[.?!]?/gi, "");

  // Drop any line that still contains strong contact markers.
  cleaned = cleaned
    .split("\n")
    .filter((line) => !/contact|name/i.test(line))
    .join("\n")
    .trim();

  return cleaned || reply;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const userId = req.body && req.body.userId ? String(req.body.userId) : null;
    const message = req.body && req.body.message ? String(req.body.message) : null;
    const model = req.body && req.body.model ? String(req.body.model) : null;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId and message",
      });
    }

    const groqApiKey = (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.grok);
    const groqModel = model || process.env.GROQ_MODEL || "llama-3.1-8b-instant";

    if (!groqApiKey) {
      return res.status(500).json({
        success: false,
        error: "Missing GROQ_API_KEY (or GROK_API_KEY/grok) in Vercel environment variables",
      });
    }

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
          {
            role: "user",
            content: message,
          },
        ],
        stream: false,
      }),
    });

    const data = await r.json().catch(() => null);
    const reply = data?.choices?.[0]?.message?.content || null;

    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: data?.error?.message || data?.error || `Groq error (HTTP ${r.status})`,
      });
    }

    if (!reply) {
      return res.status(502).json({
        success: false,
        error: "AI runtime returned an empty reply",
      });
    }

    const finalReply = stripContactIfNotRequested(message, reply);
    return res.status(200).json({
      success: true,
      reply: finalReply,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "AI server error",
    });
  }
};
