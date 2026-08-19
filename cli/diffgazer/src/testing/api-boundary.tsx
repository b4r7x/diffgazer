import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactElement, type ReactNode, useState } from "react";
import { createTestQueryClient } from "./query-client";

/**
 * The query client and API a screen's real core hooks resolve against; `api`
 * overrides the members a test drives, everything else is the plain client.
 */
export function ApiBoundary({
  api,
  children,
}: {
  api?: Partial<BoundApi>;
  children: ReactNode;
}): ReactElement {
  const [client] = useState(createTestQueryClient);
  return (
    <QueryClientProvider client={client}>
      <ApiProvider value={{ ...createApi({ baseUrl: "http://localhost" }), ...api }}>
        {children}
      </ApiProvider>
    </QueryClientProvider>
  );
}
