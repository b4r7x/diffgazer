import { Agent } from "undici";

/**
 * Undici's `headersTimeout` is the only client bound while a gateway that
 * commits headers with the answer — OpenCode Zen answers `stream:false` with
 * `headersMs` within 4ms of `endMs` on every completed probe (2026-09-03) — is
 * still generating. With no declared idle budget it sits just above the wall so
 * the dispatch deadline names the failure in its own numbers; with one it IS
 * the budget, so a stall takes the one-shot re-dispatch instead of costing the
 * whole wall.
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
  headersBudgetMs?: number,
): FetchDispatcher {
  // The reader's answer-idle timer bounds the body; undici's bodyTimeout stays above the wall.
  const bodyTimeout = wallTimeMs + RESPONSE_TIMEOUT_MARGIN_MS;
  const headersTimeout =
    headersBudgetMs === undefined ? bodyTimeout : Math.min(bodyTimeout, headersBudgetMs);
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
