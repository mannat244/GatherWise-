import { GoogleGenAI } from "@google/genai";

let genAIInstance: GoogleGenAI | null = null;

/**
 * Returns a server-side Google GenAI client instance if a valid API key is configured.
 * Never exposes credentials to client bundles.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    return null;
  }

  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({ apiKey });
  }

  return genAIInstance;
}

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
