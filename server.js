import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PatternError } from "./pattern.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Load settings from .env (if present) before the provider module reads them.
try {
  process.loadEnvFile(path.join(here, ".env"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
  console.warn("No .env file found. Copy .env.example to .env and add your API key.");
}

const app = express();

const PORT = process.env.PORT || 3000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const PROVIDERS = ["gemini", "claude"];

const providerName = (process.env.AI_PROVIDER || "gemini").toLowerCase();
if (!PROVIDERS.includes(providerName)) {
  console.error(`Unknown AI_PROVIDER "${providerName}". Use one of: ${PROVIDERS.join(", ")}.`);
  process.exit(1);
}
const provider = await import(`./providers/${providerName}.js`);

// The browser downscales photos before upload, so 10 MB of JSON is plenty.
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(here, "public")));

app.post("/api/pattern", async (req, res) => {
  const { image, mediaType, notes } = req.body ?? {};

  if (typeof image !== "string" || !image) {
    return res.status(400).json({ error: "Please upload an image." });
  }
  if (!ALLOWED_TYPES.has(mediaType)) {
    return res.status(400).json({ error: "Unsupported image type. Use JPEG, PNG, GIF, or WebP." });
  }

  let userText = "Here's the object I want to crochet. Please design the full pattern.";
  if (typeof notes === "string" && notes.trim()) {
    userText += `\n\nMy notes/preferences: ${notes.trim().slice(0, 1000)}`;
  }

  try {
    res.json(await provider.generatePattern({ image, mediaType, userText }));
  } catch (err) {
    if (err instanceof PatternError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Crochet pattern maker running at http://localhost:${PORT} using ${provider.name}`);
  if (!provider.isConfigured()) {
    console.warn(`Warning: no API key set for ${providerName}. Copy .env.example to .env and add your key.`);
  }
});
