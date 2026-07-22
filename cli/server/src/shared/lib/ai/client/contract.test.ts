import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(() => true),
  readKeyringSecret: vi.fn(() => ({ ok: true, value: null })),
  writeKeyringSecret: vi.fn(() => ({ ok: true, value: undefined })),
}));
// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write results.
vi.mock("../../config/keyring.js", () => keyring);

let diffgazerHome: string;

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "dg-ai-contract-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  vi.resetModules();
});
afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  rmSync(diffgazerHome, { recursive: true, force: true });
});

describe("createLanguageModel real openai-compatible adapters", () => {
  it.each([
    "groq",
    "cerebras",
  ] as const)("returns a usable client backed by a real LanguageModel for %s", async (provider) => {
    const { createAIClient } = await import("./create.js");
    const result = createAIClient({ apiKey: "test-key", provider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe(provider);
      expect(typeof result.value.generate).toBe("function");
    }
  });
});

const LIVE = process.env.DIFFGAZER_LIVE_AI === "1";

const liveProviders = [
  { provider: "groq" as const, keyEnv: "GROQ_API_KEY" },
  { provider: "cerebras" as const, keyEnv: "CEREBRAS_API_KEY" },
];

describe.runIf(LIVE)("createLanguageModel live generateText smoke (network-gated)", () => {
  for (const { provider, keyEnv } of liveProviders) {
    const apiKey = process.env[keyEnv];
    it.skipIf(!apiKey)(`produces a structured object via ${provider}`, async () => {
      const { createAIClient } = await import("./create.js");
      const clientResult = createAIClient({ apiKey: apiKey as string, provider });
      expect(clientResult.ok).toBe(true);
      if (!clientResult.ok) return;
      const result = await clientResult.value.generate(
        "Return an object with field ok set to true.",
        z.object({ ok: z.boolean() }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.ok).toBe(true);
    });
  }
});
