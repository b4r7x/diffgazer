# Contract: Shared Hooks Package (`@diffgazer/api/hooks`)

## Invariants

1. **All data fetching in both CLI and web MUST go through shared hooks** — no local `useQuery`/`useMutation` definitions in either app.
2. **Documented exceptions** (files that bypass hooks for architectural reasons) MUST be limited to:
   - API singleton creation (`lib/api.ts` in both apps)
   - Router guards (`config-guards.ts` in web — not a React component)
   - Imperative one-shot loads (`review/page.tsx` in web — state machine initializer)
   - Utility functions (`shutdown.ts` in web — fire-and-forget)
3. **Query key hierarchy MUST be maintained** — mutations invalidate via documented key prefixes.
4. **CLI QueryClient MUST use `networkMode: 'always'`** with `refetchOnWindowFocus: false` and `refetchOnReconnect: false`.

## Public API Surface (frozen — no removals)

### Exports (22 total)
- Context: `ApiProvider`, `useApi`
- Config queries (5): `useSettings`, `useInit`, `useConfigCheck`, `useProviderStatus`, `useOpenRouterModels`
- Config mutations (4): `useSaveSettings`, `useSaveConfig`, `useActivateProvider`, `useDeleteProviderCredentials`
- Review queries (4): `useReviews`, `useReview`, `useActiveReviewSession`, `useReviewContext`
- Review mutations (2): `useDeleteReview`, `useRefreshReviewContext`
- Trust mutations (2): `useSaveTrust`, `useDeleteTrust`
- Server (2): `useServerStatus`, `useShutdown`
- Streaming (1): `useReviewStream`
- Utilities: `matchQueryState`, `configQueries`
- Types: `ServerState`, `ReviewStreamState`

### Additions Allowed
- New shared hooks (e.g., `useDiagnosticsData`)
- New query factories
- New utility functions

### Removals NOT Allowed
- No existing hook may be removed without ensuring zero consumers in both apps
