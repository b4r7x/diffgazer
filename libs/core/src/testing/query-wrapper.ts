import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { type BoundApi, createApi } from "../api/bound.js";
import { ApiProvider as DefaultApiProvider } from "../api/hooks/context.js";

interface TestQueryWrapperOptions {
  api?: Partial<BoundApi>;
  ApiProvider?: typeof DefaultApiProvider;
}

interface TestQueryWrapper {
  Wrapper: FunctionComponent<{ children: ReactNode }>;
  queryClient: QueryClient;
  api: BoundApi;
}

/**
 * Every `BoundApi` member the test did not override rejects by name instead of
 * reaching the real client, so a missing double surfaces as its own failure
 * rather than an unintended request collapsed into a generic network error.
 */
function rejectUnstubbedApi(): BoundApi {
  const methods = Object.keys(
    createApi({ baseUrl: "http://unstubbed.invalid" }),
  ) as (keyof BoundApi)[];
  const rejecting = {} as Record<keyof BoundApi, () => never>;
  for (const method of methods) {
    rejecting[method] = () => {
      throw new Error(`createTestQueryWrapper: api.${method}() was called without a test double`);
    };
  }
  return rejecting;
}

export function createTestQueryWrapper(options: TestQueryWrapperOptions = {}): TestQueryWrapper {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api: BoundApi = {
    ...rejectUnstubbedApi(),
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
