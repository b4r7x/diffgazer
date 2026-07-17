import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ORIGINS = {
  docs: "https://docs.b4r7.dev",
  landing: "https://diffgazer.b4r7.dev",
};

export function selectedIdentitySurfaces(target) {
  switch (target) {
    case "docs-registry":
      return ["docs"];
    case "landing":
      return ["landing"];
    case "all":
      return ["docs", "landing"];
    default:
      throw new Error(`Unknown deploy target: ${target}`);
  }
}

const defaultSleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

export async function waitForSourceTag({
  surface,
  origin,
  expected,
  fetchImpl = fetch,
  sleep = defaultSleep,
  now = Date.now,
  timeoutMs = 5 * 60_000,
  intervalMs = 15_000,
}) {
  const deadline = now() + timeoutMs;
  const url = new URL("/source-tag", origin);
  url.searchParams.set("expected", expected);

  while (now() < deadline) {
    try {
      const response = await fetchImpl(url, {
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(Math.min(10_000, Math.max(1, deadline - now()))),
      });
      if (response.ok && (await response.text()).trim() === expected) {
        return;
      }
    } catch {
      // The public origin can be unavailable while its container is replaced.
    }

    await sleep(intervalMs);
  }

  throw new Error(`${surface} did not report source tag ${expected} at ${url.origin}/source-tag`);
}

export async function verifySelectedSourceTags({
  target,
  expected,
  origins = DEFAULT_ORIGINS,
  ...dependencies
}) {
  if (!/^[a-f0-9]{40}$/.test(expected)) {
    throw new Error("SOURCE_TAG must be a full 40-character lowercase commit SHA.");
  }

  await Promise.all(
    selectedIdentitySurfaces(target).map((surface) =>
      waitForSourceTag({
        surface,
        origin: origins[surface],
        expected,
        ...dependencies,
      }),
    ),
  );
}

const isDirectRun =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  await verifySelectedSourceTags({
    target: process.env.DEPLOY_TARGET,
    expected: process.env.SOURCE_TAG,
  });
  console.log(`OK: selected public surfaces report ${process.env.SOURCE_TAG}`);
}
