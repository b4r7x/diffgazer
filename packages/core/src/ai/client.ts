// Direct re-export of Gemini client as the AI client
// The factory pattern was removed since only Gemini is supported
export { createGeminiClient as createAIClient } from "./providers/gemini.js";
