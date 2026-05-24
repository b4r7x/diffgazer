import { QueryClient } from "@tanstack/react-query";

export function createWebQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failureCount, error) => {
          if (
            error instanceof Error &&
            "status" in error &&
            typeof (error as Error & { status: unknown }).status === "number"
          ) {
            const status = (error as Error & { status: number }).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}
