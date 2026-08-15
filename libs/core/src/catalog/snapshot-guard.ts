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

function countCatalogModels(catalog: ModelsDevCatalog): number {
  return Object.values(catalog).reduce(
    (total, provider) => total + Object.keys(provider.models).length,
    0,
  );
}

/**
 * Guards a snapshot refresh before it overwrites the committed offline catalog.
 * `parseModelsDevCatalog` is deliberately tolerant, so a syntactically valid but
 * thinned payload — a captured error body, a truncated upstream response — would
 * otherwise ship an empty or partial fallback and report success. Returns a
 * defect message carrying raw-versus-survivor counts, or `null` when the trimmed
 * catalog covers every required overlay source with at least one usable model.
 */
export function findCatalogSnapshotDefect(
  raw: unknown,
  trimmed: ModelsDevCatalog,
  requiredSourceIds: ReadonlySet<string>,
): string | null {
  const missing: string[] = [];
  const empty: string[] = [];
  for (const sourceId of [...requiredSourceIds].sort()) {
    const provider = trimmed[sourceId];
    if (!provider) missing.push(sourceId);
    else if (Object.keys(provider.models).length === 0) empty.push(sourceId);
  }

  if (missing.length === 0 && empty.length === 0) return null;

  const defects: string[] = [];
  if (missing.length > 0) defects.push(`missing sources: ${missing.join(", ")}`);
  if (empty.length > 0) defects.push(`sources without a usable model: ${empty.join(", ")}`);
  return `${defects.join("; ")} (raw models: ${countRawModels(raw)}, kept models: ${countCatalogModels(trimmed)})`;
}
