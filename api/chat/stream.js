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

Answer FAQs:
- Warranty -> Official / store-based
- Delivery -> Available
- Products -> Apple devices + accessories

When the user asks about warranty, delivery/shipping, or return/refund, use the store policy excerpts provided by the system.

Hard rules:
- Keep every response short (max ~35 words).
- Suggest exactly 2 options max.
- No extra paragraphs. Use this format only:
  Option 1: <product> - <reason>. Option 2: <product> - <reason>. Then: <one question>.
- Product comparison: If the user asks to compare/choose between two products (compare, between, vs, “which is better”), still output exactly 2 options in the same format, and make each reason clearly highlight the key difference vs the other (focus on camera, performance, battery, portability, etc.). Do NOT mention exact prices.
- Use Nepali Rupees (NPR). If the user mentions budget in USD ($), convert approximately (1 USD ~= 135 NPR) and refer only to NPR (do not show the $ value).
- Never invent future/unavailable models. If asked, say you only recommend from available lineup and ask budget/usage.
- Never include exact prices or price ranges.
- Ask for name+contact ONLY when the user message contains at least one of these keywords: price, cost, available, discount, offer, warranty, delivery, shipping, return, refund, exchange. Otherwise do not ask for contact.
- You may include the product page URL for recommended items. Do NOT invent URLs; only include a URL if you are confident it is correct. If unsure, omit the URL.
`;

const siteBaseUrl = process.env.SITE_BASE_URL || "https://macstore.com.np";

async function readBody(req) {
  if (!req || req.body == null) return {};
  return req.body;
}

function isEmiRequest(text) {
  var t = String(text || "").toLowerCase();
  return (
    t.indexOf("emi") !== -1 ||
    t.indexOf("installment") !== -1 ||
    t.indexOf("installments") !== -1 ||
    t.indexOf("monthly payment") !== -1
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const userId = body && body.userId ? String(body.userId) : null;
    const message = body && body.message ? String(body.message) : null;
    const model = body && body.model ? String(body.model) : null;
    const page = body && body.page ? body.page : null;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId and message",
      });
    }

    const pageContext =
      page && page.type === "product" && page.name
        ? `User is viewing product page: ${page.name}. Focus recommendations on related variants/accessories of this product family.`
        : "";

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
      res.end();
      return;
    }

    const groqApiKey =
      process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.grok;
    const groqModel = model || process.env.GROQ_MODEL || "llama-3.1-8b-instant";
    if (!groqApiKey) {
      // Keep frontend streaming parser happy by returning a valid SSE message.
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

    const systemContent =
      systemPrompt +
      "\n\n" +
      knowledge +
      "\n\nProduct links should use this base URL:\n" +
      siteBaseUrl +
      "\n(Use paths like /productview/...; do not invent slugs.)" +
      (pageContext ? "\n\n" + pageContext : "");

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    if (!groqRes.ok) {
      const t = await groqRes.text().catch(() => "");
      return res.status(groqRes.status).json({ success: false, error: t || `Groq error (HTTP ${groqRes.status})` });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders && res.flushHeaders();

    const reader = groqRes.body && groqRes.body.getReader ? groqRes.body.getReader() : null;
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
    // Return a valid SSE payload so the frontend never shows HTTP 500.
    try {
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
    } catch {}
  }
};

