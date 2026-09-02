import { Agent } from "undici";

/**
 * The runtime's HTTP client caps a silent response at its own default
 * headers/body timeout (300s), so a per-dispatch wall above that could never be
 * reached: the client gave up while the model was still queued. Each distinct
 * wall gets one pooled agent whose response timeouts sit just above it, which
 * makes the dispatch deadline — the bound that names its own numbers in the
 * diagnostic — the one that actually fires.
 */
const RESPONSE_TIMEOUT_MARGIN_MS = 5_000;

type FetchDispatcher = NonNullable<RequestInit["dispatcher"]>;

const agentsByWallTimeMs = new Map<number, Agent>();

// `@types/node` bundles undici-types 6 while the runtime client is undici 7:
// the same dispatcher described by two drifted structural types, crossed here
// rather than at every request the wire builds.
function asFetchDispatcher(agent: Agent): FetchDispatcher {
  return agent as unknown as FetchDispatcher;
}

export function responseTimeoutDispatcher(wallTimeMs: number): FetchDispatcher {
  const pooled = agentsByWallTimeMs.get(wallTimeMs);
  if (pooled) return asFetchDispatcher(pooled);
  const timeoutMs = wallTimeMs + RESPONSE_TIMEOUT_MARGIN_MS;
  const agent = new Agent({
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });
  agentsByWallTimeMs.set(wallTimeMs, agent);
  return asFetchDispatcher(agent);
}

/**
 * Shutdown seam: each pooled agent holds keep-alive sockets that outlive the
 * review that opened them, so the process would linger behind them. Destroy
 * rather than close — the sessions are aborted before this runs, and a graceful
 * close would wait on requests nobody is reading any more.
 */
export async function closeDispatchers(): Promise<void> {
  const agents = [...agentsByWallTimeMs.values()];
  agentsByWallTimeMs.clear();
  await Promise.all(agents.map((agent) => agent.destroy()));
}
