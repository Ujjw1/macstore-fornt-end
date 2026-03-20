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
            content:
              "You are a helpful assistant for an Apple store in Nepal. Help users choose products.",
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
