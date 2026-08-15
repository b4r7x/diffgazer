import { useRouterState } from "@tanstack/react-router";
import { LEGAL_PAGES } from "@/features/legal/lib/pages";

export function useIsLegalRoutePending(): boolean {
  return useRouterState({
    select: (state) =>
      state.isLoading && LEGAL_PAGES.some((page) => page.path === state.location.pathname),
  });
}
