import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ctx, type DiffgazerAddConfig, DiffgazerAddConfigSchema } from "../../context.js";
import type { InitOptions } from "./plan.js";

const installedItemsSchema = DiffgazerAddConfigSchema.shape.installedItems;

const FORCE_PARSE_ERROR_MESSAGE =
  "Cannot re-initialize a malformed diffgazer.json with --force without also passing " +
  "--reset-manifest, because the installed-item ownership ledger cannot be recovered. " +
  "Fix the syntax error, delete diffgazer.json, or pass both --force and --reset-manifest " +
  "to discard the ledger and re-initialize.";

const FORCE_INVALID_LEDGER_MESSAGE =
  "diffgazer.json has an invalid installedItems ledger that cannot be preserved. " +
  "Pass --reset-manifest with --force to discard the ledger and re-initialize.";

function recoverInstalledItemsLedger(
  cwd: string,
): DiffgazerAddConfig["installedItems"] | undefined {
  const configPath = resolve(cwd, "diffgazer.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  const raw = record.installedItems;
  if (raw === undefined) {
    return undefined;
  }

  const result = installedItemsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(FORCE_INVALID_LEDGER_MESSAGE);
  }

  return result.data;
}

export function resolveInstalledItemsForInit(
  cwd: string,
  initOptions: InitOptions,
): DiffgazerAddConfig["installedItems"] | undefined {
  if (initOptions.resetManifest) {
    return undefined;
  }

  const existing = ctx.config.loadConfig(cwd);
  if (existing.ok) {
    return existing.config.installedItems;
  }

  if (existing.error === "validation_error") {
    return recoverInstalledItemsLedger(cwd);
  }

  if (existing.error === "parse_error") {
    throw new Error(FORCE_PARSE_ERROR_MESSAGE);
  }

  return undefined;
}

export function assertForceRecoveryAllowed(
  cwd: string,
  opts: Record<string, unknown>,
  initOptions: InitOptions,
): void {
  if (opts.force !== true || initOptions.resetManifest) {
    return;
  }

  const existing = ctx.config.loadConfig(cwd);
  if (!existing.ok && existing.error === "parse_error") {
    throw new Error(FORCE_PARSE_ERROR_MESSAGE);
  }

  if (!existing.ok && existing.error === "validation_error") {
    assertLedgerRecoverable(cwd);
  }
}

// init fails before touching the project when the ledger cannot survive --force;
// the recovered value itself is read again at write time.
function assertLedgerRecoverable(cwd: string): void {
  recoverInstalledItemsLedger(cwd);
}
