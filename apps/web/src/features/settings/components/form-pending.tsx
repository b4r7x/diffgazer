import { matchQueryState } from "@diffgazer/core/api/hooks";
import { Callout } from "@diffgazer/ui/components/callout";
import { Spinner } from "@diffgazer/ui/components/spinner";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CardLayout } from "@/components/layout/card";

// Gates a settings detail query: renders the page CardLayout with a spinner
// while loading and a Callout on error, or null once the data is ready.
export function renderSettingsFormPending<T>(
  query: UseQueryResult<T>,
  title: string,
  subtitle: string,
): ReactNode {
  return matchQueryState(query, {
    loading: () => (
      <CardLayout title={title} subtitle={subtitle}>
        <Spinner variant="braille" className="text-muted-foreground">
          Loading settings...
        </Spinner>
      </CardLayout>
    ),
    error: (err) => (
      <CardLayout title={title} subtitle={subtitle}>
        <Callout tone="error" live>
          <Callout.Content>{err.message}</Callout.Content>
        </Callout>
      </CardLayout>
    ),
    success: () => null,
  });
}
