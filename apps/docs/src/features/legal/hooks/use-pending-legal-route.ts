import { useRouterState } from "@tanstack/react-router";
import { LEGAL_PAGES } from "@/features/legal/lib/pages";

export function usePendingLegalRoute(): string | null {
  return useRouterState({
    select: (state) => {
      const { pathname } = state.location;
      if (!state.isLoading || !LEGAL_PAGES.some((page) => page.path === pathname)) return null;
      return pathname;
    },
  });
}
