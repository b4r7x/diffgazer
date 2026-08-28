import { type ModelsDevCatalog, parseModelsDevCatalog } from "@diffgazer/core/catalog";
import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { readJsonResponseWithLimit } from "../http-json.js";
import { countModels } from "./cache.js";

const MODELS_DEV_URL = "https://models.dev/api.json";
/** Reject a live payload smaller than this fraction of the known baseline. */
const SHRINK_GUARD_RATIO = 0.5;

/** Count the model entries in a raw upstream payload, before per-model parsing drops invalid ones. */
const countRawModels = (payload: unknown): number => {
  if (!payload || typeof payload !== "object") return 0;
  let total = 0;
  for (const provider of Object.values(payload as Record<string, unknown>)) {
    const models =
      provider && typeof provider === "object"
        ? (provider as Record<string, unknown>).models
        : undefined;
    if (models && typeof models === "object") total += Object.keys(models).length;
  }
  return total;
};

export const isOffline = (): boolean => {
  const flag = process.env.DIFFGAZER_OFFLINE?.trim();
  return flag !== undefined && flag !== "" && flag !== "0" && flag.toLowerCase() !== "false";
};

export interface ModelsDevFetch {
  readonly catalog: ModelsDevCatalog;
  readonly etag: string | null;
  /** models.dev answered 304 to `revalidate.etag`: `catalog` is the cached one, current again. */
  readonly revalidated: boolean;
}

// Live fetch + parse + shrink/corruption guard. Exported as a test seam; production reaches it via catalogProviderModels.get.
export const fetchModelsDevCatalog = async (options?: {
  baselineModelCount?: number;
  revalidate?: { etag: string; catalog: ModelsDevCatalog };
}): Promise<Result<ModelsDevFetch, { message: string }>> => {
  const revalidate = options?.revalidate;
  let response: Response;
  try {
    // redirect: "error" pins the destination to models.dev — a 3xx to a foreign or
    // link-local host MUST fail, not be followed and persisted into the shared cache.
    response = await fetch(MODELS_DEV_URL, {
      ...(revalidate ? { headers: { "if-none-match": revalidate.etag } } : {}),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  } catch (error) {
    return err({ message: getErrorMessage(error, "Failed to fetch models.dev catalog") });
  }
  if (revalidate && response.status === 304) {
    return ok({ catalog: revalidate.catalog, etag: revalidate.etag, revalidated: true });
  }
  if (!response.ok)
    return err({ message: `models.dev catalog request failed: ${response.status}` });

  const payloadResult = await readJsonResponseWithLimit(response, "models.dev catalog");
  if (!payloadResult.ok) return payloadResult;

  const payload = payloadResult.value;

  const catalog = parseModelsDevCatalog(payload);
  const liveCount = countModels(catalog);
  const rawCount = countRawModels(payload);

  // Corruption guard: the post-parse count can't see a mass silent drop, so compare
  // survivors against the raw upstream size.
  if (rawCount > 0 && liveCount < rawCount * SHRINK_GUARD_RATIO) {
    return err({
      message: `models.dev catalog corruption-guard tripped: ${liveCount} of ${rawCount} raw models survived parsing`,
    });
  }

  const baseline = options?.baselineModelCount ?? 0;
  if (baseline > 0 && liveCount < baseline * SHRINK_GUARD_RATIO) {
    return err({
      message: `models.dev catalog shrink-guard tripped: ${liveCount} models vs baseline ${baseline}`,
    });
  }
  if (liveCount === 0) return err({ message: "models.dev catalog parsed to zero models" });

  return ok({ catalog, etag: response.headers.get("etag"), revalidated: false });
};
