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
- Suggest 2-3 options max

If user asks:
- price
- availability
- discount

Then:
- Ask for name and contact
- Suggest store contact

Example:
"Please share your name and contact, our team will assist you with latest price and offers."

Answer FAQs:
- Warranty -> Official / store-based
- Delivery -> Available
- Products -> Apple devices + accessories

Keep answers:
- Short
- Clear
- Trust-building
`;

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

    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = model || process.env.GROQ_MODEL || "llama-3.1-8b-instant";

    if (!groqApiKey) {
      return res.status(500).json({
        success: false,
        error: "Missing GROQ_API_KEY in Vercel environment variables",
      });
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
            content: systemPrompt + "\n\n" + knowledge,
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

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "AI server error",
    });
  }
};
