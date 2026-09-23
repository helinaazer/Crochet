import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, PATTERN_SCHEMA, PatternError } from "../pattern.js";

const client = new Anthropic();

export const name = "Claude (claude-opus-5)";
export const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function generatePattern({ image, mediaType, userText }) {
  let message;
  try {
    // Streaming keeps long pattern generations clear of HTTP timeouts.
    const stream = client.beta.messages.stream({
      model: "claude-opus-5",
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: PATTERN_SCHEMA },
      },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: userText },
          ],
        },
      ],
    });
    message = await stream.finalMessage();
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.AuthenticationError) {
      throw new PatternError(500, "Server is missing a valid ANTHROPIC_API_KEY.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new PatternError(429, "Too many requests right now. Please wait a moment and try again.");
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new PatternError(400, "The image couldn't be processed. Try a different photo.");
    }
    if (err instanceof Anthropic.APIError) {
      throw new PatternError(502, "The AI service had a problem. Please try again.");
    }
    throw new PatternError(500, "The AI service isn't configured. Set ANTHROPIC_API_KEY in your .env file and restart.");
  }

  if (message.stop_reason === "refusal") {
    throw new PatternError(422, "Claude declined to create a pattern for this image. Try a different photo.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new PatternError(502, "The pattern was too long to finish. Try again or photograph a simpler object.");
  }

  const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new PatternError(502, "Received an unreadable pattern. Please try again.");
  }
}
