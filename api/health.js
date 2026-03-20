module.exports = async function handler(_req, res) {
  const hasApiKey = Boolean(process.env.GROQ_API_KEY);
  return res.status(hasApiKey ? 200 : 500).json({
    ok: hasApiKey,
    ai: hasApiKey ? "groq-configured" : "unconfigured",
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    timestamp: new Date().toISOString(),
    error: hasApiKey ? undefined : "Missing GROQ_API_KEY in Vercel environment variables",
  });
};
