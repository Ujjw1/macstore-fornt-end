# Fix chatbot on a static live site (404)

Your **website** is static (no Node). The chatbot must call a **separate URL** where **`server.js`** runs.

## Vercel-only quick setup (recommended for you)

This repo now includes Vercel serverless functions:

- `api/chat.js`
- `api/health.js`

So you do **not** need a separate API host.

1. Open your Vercel project (`macstore-fornt-end`).
2. Go to **Settings → Environment Variables**.
3. Add:
   - `GROQ_API_KEY` = your key
   - `GROQ_MODEL` = `llama-3.1-8b-instant` (optional)
4. Redeploy.
5. Test:
   - `https://macstore-fornt-end.vercel.app/api/health`

On Vercel same-domain setup, keep this tag empty in `index.html`:

`<meta name="macstore-chat-api" content="" />`

The frontend will use `/api/chat` on the same domain.

## Step 1 — Deploy the API (Node)

Use any host that runs Node 18+ (examples: **Render**, **Railway**, **Fly.io**, VPS).

| Setting | Value |
|--------|--------|
| **Start command** | `node server.js` |
| **Install** | `npm install` (default) |
| **Port** | Host sets `PORT`; your app already uses `process.env.PORT` |

**Environment variables** on the host:

| Variable | Example |
|----------|---------|
| `GROQ_API_KEY` | Your Groq secret key |
| `GROQ_MODEL` | `llama-3.1-8b-instant` |
| `CORS_ORIGIN` | Your real site origins, comma-separated |

**`CORS_ORIGIN` must match the browser address exactly**, including `https` and no trailing slash:

```text
https://macstore.com.np,https://www.macstore.com.np
```

For a quick test only (less strict):

```text
*
```

After deploy, open in a browser:

`https://YOUR-SERVICE.onrender.com/api/health`

You should see JSON like `"ai":"groq-configured"`.

## Step 2 — Point the website to the API

Edit **`index.html`** on your **static** host (the same file users load):

Replace the empty `content` with your **full** chat URL:

```html
<meta name="macstore-chat-api" content="https://YOUR-SERVICE.onrender.com/api/chat" />
```

Upload / redeploy the static site.

## Step 3 — Test

1. Open your **live** homepage.
2. Open DevTools → **Network**, send a chat message.
3. Request should go to `https://YOUR-SERVICE.../api/chat` (not your static domain).
4. Status **200** and a reply → OK.

## If you see CORS errors instead of 404

- Add your exact site URL to `CORS_ORIGIN` on the API (including `www` if you use it).
- Redeploy the API after changing env vars.

## If you control the server (cPanel + Node)

You can run `node server.js` **on the same domain** behind a reverse proxy so `/api/chat` is on the same host; then leave the meta tag **empty** (`content=""`).
