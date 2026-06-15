import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { type BoundApi, createApi } from "../api/bound.js";
import { ApiProvider as DefaultApiProvider } from "../api/hooks/context.js";

interface TestQueryWrapperOptions {
  api?: Partial<BoundApi>;
  ApiProvider?: typeof DefaultApiProvider;
}

export function createTestQueryWrapper(options: TestQueryWrapperOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api: BoundApi = {
    ...createApi({ baseUrl: "http://localhost" }),
    ...options.api,
  };
  const ApiProvider = options.ApiProvider ?? DefaultApiProvider;

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
  }

  return { Wrapper, queryClient, api };
}
