# Stitch It — crochet patterns from a photo

Upload (or snap) a photo of something around you and get a complete crochet pattern for it:

- **Yarn**: weight, fiber, and every color matched to the photo (with swatches and yardage)
- **Hook** size (mm and US) and gauge
- **All other materials** (stuffing, safety eyes, markers, needle…)
- **Step-by-step instructions**, round by round with stitch counts, plus a checklist to track progress

It uses an AI vision model to read the image and design the pattern: **Google Gemini** by default (free tier), or **Claude** if you switch `AI_PROVIDER`.

## Setup

Requires Node.js 20.12+.

```bash
npm install
cp .env.example .env      # then put your Gemini API key in .env
npm start
```

Open http://localhost:3000.

Get a free Gemini API key at https://aistudio.google.com/apikey (no credit card needed; the free tier has rate limits).

To use Claude instead, set `AI_PROVIDER=claude` and `ANTHROPIC_API_KEY` in `.env`.

## How it works

- `public/` is the frontend. The browser downscales photos to at most 1568px as a JPEG before upload.
- `server.js` is an Express server. `POST /api/pattern` hands the image to the selected provider in `providers/`.
- `pattern.js` holds the shared prompt and JSON schema. Both providers ask for JSON matching that schema, so the pattern always comes back in the same shape for the page to render.
