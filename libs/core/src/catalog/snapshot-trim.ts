import { producesTextOutput } from "./model-capability.js";
import type { ModelsDevCatalog, ModelsDevModel } from "./schema.js";

const dropUndefined = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;

// Keep only the fields the transform layer reads. modalities, knowledge, the
// release/update dates, and the cache_read/cache_write prices have no
// production consumers, so they stay out of the bundled snapshot. `modalities`
// is dropped after the pre-trim text filter below has already used it, so the
// offline snapshot carries text-capable models only.
function trimModel(model: ModelsDevModel): ModelsDevModel {
  return dropUndefined({
    id: model.id,
    name: model.name,
    family: model.family,
    cost: model.cost && dropUndefined({ input: model.cost.input, output: model.cost.output }),
    limit:
      model.limit && dropUndefined({ context: model.limit.context, output: model.limit.output }),
    // An explicit upstream null is the same "unknown" as an absent field, so it
    // collapses to one spelling instead of shipping two in the snapshot.
    structured_output: model.structured_output ?? undefined,
  });
}

const sortKeys = <T>(record: Record<string, T>): [string, T][] =>
  Object.entries(record).sort(([left], [right]) => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });

export function trimCatalogSnapshot(
  parsed: ModelsDevCatalog,
  wantedSourceIds: ReadonlySet<string>,
): ModelsDevCatalog {
  const trimmed: ModelsDevCatalog = {};
  for (const [id, provider] of sortKeys(parsed)) {
    if (!wantedSourceIds.has(id)) continue;
    const models: Record<string, ModelsDevModel> = {};
    for (const [modelId, model] of sortKeys(provider.models)) {
      if (!producesTextOutput(model)) continue;
      models[modelId] = trimModel(model);
    }
    trimmed[id] = { ...provider, models };
  }
  return trimmed;
}
