import { useRouterState } from "@tanstack/react-router";
import { isDocsPath } from "@/lib/docs-library";

export function usePendingDocsRoute(): string | null {
	return useRouterState({
		select: (state) => {
			if (state.status !== "pending") return null;
			return isDocsPath(state.location.pathname)
				? state.location.pathname
				: null;
		},
	});
}
