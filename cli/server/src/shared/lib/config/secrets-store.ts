import type { AIProvider, CredentialRef } from "@diffgazer/core/schemas/config";
import { PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import type { SecretEntry } from "./types.js";

/** Normalize a credential input (string or CredentialRef) into a SecretEntry for persistence. */
export function toSecretEntry(
  apiKey: string | CredentialRef,
  providerId: AIProvider,
): { entry: SecretEntry; resolvedValue: string | null } {
  if (typeof apiKey === "string") {
    // Migrate legacy "env" sentinel strings
    if (apiKey === "env") {
      const varName = PROVIDER_ENV_VARS[providerId];
      return {
        entry: { kind: "env", varName },
        resolvedValue: process.env[varName] ?? null,
      };
    }
    return { entry: apiKey, resolvedValue: apiKey };
  }
  if (apiKey.kind === "env") {
    return {
      entry: { kind: "env", varName: apiKey.varName },
      resolvedValue: process.env[apiKey.varName] ?? null,
    };
  }
  return { entry: apiKey.value, resolvedValue: apiKey.value };
}

/** Resolve a secret entry to its runtime value. */
export function resolveSecretEntry(entry: SecretEntry): string | null {
  if (typeof entry === "string") return entry;
  if (entry.kind === "env") return process.env[entry.varName] ?? null;
  return null;
}
