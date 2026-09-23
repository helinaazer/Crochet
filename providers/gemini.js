import { GoogleGenAI, ApiError } from "@google/genai";
import { SYSTEM_PROMPT, PATTERN_SCHEMA, PatternError } from "../pattern.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const name = `Gemini (${MODEL})`;
export const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const RETRY_DELAYS_MS = [2000, 5000, 10000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The free tier often answers 503 ("high demand"); those usually clear within seconds.
async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err instanceof ApiError && (err.status === 503 || err.status === 500);
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw err;
      console.warn(`Gemini returned ${err.status}; retrying in ${RETRY_DELAYS_MS[attempt] / 1000}s…`);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

export async function generatePattern({ image, mediaType, userText }) {
  let response;
  try {
    response = await withRetry(() => ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mediaType, data: image } },
            { text: userText },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: PATTERN_SCHEMA,
        maxOutputTokens: 32768,
      },
    }));
  } catch (err) {
    console.error(err);
    if (err instanceof ApiError) {
      if (err.status === 503) {
        throw new PatternError(503, "Gemini is overloaded right now (common on the free tier). Please try again in a minute.");
      }
      if (err.status === 429) {
        throw new PatternError(429, "Gemini's free-tier limit was reached. Wait a minute (or until tomorrow for the daily limit) and try again.");
      }
      if (/api key/i.test(err.message) || err.status === 401 || err.status === 403) {
        throw new PatternError(500, "The Gemini API key is missing or invalid. Check GEMINI_API_KEY in your .env file.");
      }
      if (err.status === 404) {
        throw new PatternError(500, `The Gemini model "${MODEL}" wasn't found. Check GEMINI_MODEL in your .env file.`);
      }
      if (err.status === 400) {
        throw new PatternError(400, "The image couldn't be processed. Try a different photo.");
      }
    }
    throw new PatternError(502, "The AI service had a problem. Please try again.");
  }

  if (response.promptFeedback?.blockReason) {
    throw new PatternError(422, "Gemini declined to create a pattern for this image. Try a different photo.");
  }
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    throw new PatternError(502, "The pattern was too long to finish. Try again or photograph a simpler object.");
  }
  if (finishReason && finishReason !== "STOP") {
    throw new PatternError(422, "Gemini declined to create a pattern for this image. Try a different photo.");
  }

  try {
    return JSON.parse(response.text);
  } catch {
    throw new PatternError(502, "Received an unreadable pattern. Please try again.");
  }
}
