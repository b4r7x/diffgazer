import { createHash } from "node:crypto";

// NOTE: Identical implementation exists in ../copy-bundle.ts.
// Intentionally duplicated so installer runtime and artifact generation stay decoupled.
export function computeIntegrity(content: string): string {
  return "sha256-" + createHash("sha256").update(content).digest("hex");
}
