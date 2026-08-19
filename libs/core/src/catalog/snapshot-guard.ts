import { producesTextOutput } from "./model-capability.js";
import type { ModelsDevCatalog } from "./schema.js";

function countRawModels(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  let total = 0;
  for (const provider of Object.values(raw as Record<string, unknown>)) {
    if (!provider || typeof provider !== "object") continue;
    const models = (provider as { models?: unknown }).models;
    if (models && typeof models === "object") total += Object.keys(models).length;
  }
  return total;
}

function rawModelIds(raw: unknown, sourceId: string): string[] {
  if (!raw || typeof raw !== "object") return [];
  const provider = (raw as Record<string, unknown>)[sourceId];
  if (!provider || typeof provider !== "object") return [];
  const models = (provider as { models?: unknown }).models;
  return models && typeof models === "object" ? Object.keys(models) : [];
}

/** The models the trimmed catalog can offer; a withheld (non-text) row is kept for its id alone. */
function usableModels(catalog: ModelsDevCatalog, sourceId: string): number {
  return Object.values(catalog[sourceId]?.models ?? {}).filter(producesTextOutput).length;
}

function countUsableModels(catalog: ModelsDevCatalog): number {
  return Object.keys(catalog).reduce(
    (total, sourceId) => total + usableModels(catalog, sourceId),
    0,
  );
}

/**
 * Guards a snapshot refresh before it overwrites the committed offline catalog.
 * `parseModelsDevCatalog` is deliberately tolerant, so a syntactically valid but
 * thinned payload — a captured error body, a truncated upstream response — would
 * otherwise ship an empty or partial fallback and report success, and a
 * malformed row inside a required source would silently vanish from it. Returns
 * a defect message carrying raw-versus-survivor counts, or `null` when the
 * trimmed catalog covers every required overlay source with at least one usable
 * model and no required-source row was dropped by the parser.
 */
export function findCatalogSnapshotDefect(
  raw: unknown,
  parsed: ModelsDevCatalog,
  trimmed: ModelsDevCatalog,
  requiredSourceIds: ReadonlySet<string>,
): string | null {
  const missing: string[] = [];
  const empty: string[] = [];
  const dropped: string[] = [];
  for (const sourceId of [...requiredSourceIds].sort()) {
    if (!trimmed[sourceId]) missing.push(sourceId);
    else if (usableModels(trimmed, sourceId) === 0) empty.push(sourceId);
    const parsedModels = parsed[sourceId]?.models ?? {};
    for (const modelId of rawModelIds(raw, sourceId)) {
      if (!(modelId in parsedModels)) dropped.push(`${sourceId}/${modelId}`);
    }
  }

  if (missing.length === 0 && empty.length === 0 && dropped.length === 0) return null;

  const defects: string[] = [];
  if (missing.length > 0) defects.push(`missing sources: ${missing.join(", ")}`);
  if (empty.length > 0) defects.push(`sources without a usable model: ${empty.join(", ")}`);
  if (dropped.length > 0) defects.push(`models dropped by the parser: ${dropped.join(", ")}`);
  return `${defects.join("; ")} (raw models: ${countRawModels(raw)}, usable models: ${countUsableModels(trimmed)})`;
}
