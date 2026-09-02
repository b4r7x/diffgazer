import { Agent } from "undici";

/**
 * The runtime's HTTP client caps a silent response at its own default
 * headers/body timeout (300s), so a per-dispatch wall above that could never be
 * reached: the client gave up while the model was still queued. Each distinct
 * wall gets one pooled agent whose response timeouts sit just above it, which
 * makes the dispatch deadline — the bound that names its own numbers in the
 * diagnostic — the one that actually fires. A profile may set the body budget
 * below the wall; silence past it is the client's verdict, and the dispatch loop
 * re-dispatches once.
 */
const RESPONSE_TIMEOUT_MARGIN_MS = 5_000;

type FetchDispatcher = NonNullable<RequestInit["dispatcher"]>;

const agentsByTimeouts = new Map<string, Agent>();

// `@types/node` bundles undici-types 6 while the runtime client is undici 7:
// the same dispatcher described by two drifted structural types, crossed here
// rather than at every request the wire builds.
function asFetchDispatcher(agent: Agent): FetchDispatcher {
  return agent as unknown as FetchDispatcher;
}

export function responseTimeoutDispatcher(
  wallTimeMs: number,
  bodyIdleTimeoutMs?: number,
): FetchDispatcher {
  // Headers wait for the whole wall: pre-accept time is the queue the profile
  // funds. The body waits only as long as a healthy answer stays silent when
  // the profile bounds that; otherwise it, too, outlives the wall.
  const headersTimeout = wallTimeMs + RESPONSE_TIMEOUT_MARGIN_MS;
  const bodyTimeout = bodyIdleTimeoutMs ?? headersTimeout;
  const key = `${headersTimeout}:${bodyTimeout}`;
  const pooled = agentsByTimeouts.get(key);
  if (pooled) return asFetchDispatcher(pooled);
  const agent = new Agent({ headersTimeout, bodyTimeout });
  agentsByTimeouts.set(key, agent);
  return asFetchDispatcher(agent);
}

/**
 * Shutdown seam: each pooled agent holds keep-alive sockets that outlive the
 * review that opened them, so the process would linger behind them. Destroy
 * rather than close — the sessions are aborted before this runs, and a graceful
 * close would wait on requests nobody is reading any more.
 */
export async function closeDispatchers(): Promise<void> {
  const agents = [...agentsByTimeouts.values()];
  agentsByTimeouts.clear();
  await Promise.all(agents.map((agent) => agent.destroy()));
}
