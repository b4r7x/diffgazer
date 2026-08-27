import { producesTextOutput } from "./model-capability.js";
import type { ModelsDevCatalog, ModelsDevModel } from "./schema.js";

const dropUndefined = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;

// Keep only the fields the transform layer reads. knowledge, last_updated, and
// the cache_read/cache_write prices have no production consumers, so they stay
// out of the bundled snapshot. release_date survives on rows the transform can
// offer: the picker sorts newest first on it. `modalities` survives only where
// it withholds the model (output that cannot carry a review object): the
// transform still refuses the row,
// and the id stays known offline, so a provider's live list cannot resurrect a
// model the catalog deliberately withheld when models.dev is out of reach.
function trimModel(model: ModelsDevModel): ModelsDevModel {
  const offerable = producesTextOutput(model);
  return dropUndefined({
    id: model.id,
    name: model.name,
    cost: model.cost && dropUndefined({ input: model.cost.input, output: model.cost.output }),
    limit:
      model.limit && dropUndefined({ context: model.limit.context, output: model.limit.output }),
    // An explicit upstream null is the same "unknown" as an absent field, so it
    // collapses to one spelling instead of shipping two in the snapshot.
    structured_output: model.structured_output ?? undefined,
    release_date: offerable ? model.release_date : undefined,
    modalities: offerable ? undefined : { output: model.modalities?.output },
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
      models[modelId] = trimModel(model);
    }
    trimmed[id] = { ...provider, models };
  }
  return trimmed;
}
