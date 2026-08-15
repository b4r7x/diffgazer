import "./terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { escapeRegExp } from "@diffgazer/core/redaction";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
  ModelInfo,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import {
  GEMINI_CONFIGURATION,
  makeAllConfigurationsListResponse,
} from "@diffgazer/core/testing/provider-fixtures";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { createTestQueryClient } from "../../../testing/query-client";
import { CliThemeProvider } from "../../../theme/provider";

export const ARROW_DOWN = "\u001b[B";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";

export function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

const GEMINI_MODELS: ModelInfo[] = [
  {
    id: "gemini-2.5-flash",
    name: "gemini-2.5-flash",
    description: "1M context",
    tier: "paid" as const,
  },
];

export function catalogModelsResponse(
  configuration: ClientConfigurationSummary,
  models: ModelInfo[] = GEMINI_MODELS,
): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models,
    checkedAt: CHECKED_AT,
    source: "snapshot",
    cached: false,
  };
}

export function skippedCatalogModelsResponse(
  configuration: ClientConfigurationSummary,
  reason: string,
): ConfigurationModelsResponse {
  return {
    status: "skipped",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models: [],
    checkedAt: CHECKED_AT,
    reason,
  };
}

export function geminiName(id: string): string {
  const model = GEMINI_MODELS.find((entry) => entry.id === id);
  if (!model) throw new Error(`Gemini discovery fixture is missing model "${id}"`);
  return model.name;
}

export { flush } from "../../../testing/flush";

export async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for condition after ${attempts} attempts`);
}

export function makeGeminiApi(): BoundApi {
  const listConfigurations = vi
    .fn<BoundApi["listConfigurations"]>()
    .mockResolvedValue(makeAllConfigurationsListResponse());
  const getConfigurationModels = vi
    .fn<BoundApi["getConfigurationModels"]>()
    .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    listConfigurations,
    getConfigurationModels,
  } satisfies BoundApi;
}

export function countPrefixes(
  frame: string | undefined,
  name: string,
): {
  highlighted: number;
  unhighlighted: number;
} {
  if (!frame) return { highlighted: 0, unhighlighted: 0 };
  const escaped = escapeRegExp(name);
  const highlightedMatches = frame.match(new RegExp(`>\\s+\\[\\s\\]\\s+${escaped}`, "g")) ?? [];
  const unhighlightedMatches =
    frame.match(new RegExp(`(?<!>)\\s\\s+\\[\\s\\]\\s+${escaped}`, "g")) ?? [];
  return {
    highlighted: highlightedMatches.length,
    unhighlighted: unhighlightedMatches.length,
  };
}

export function Wrapper({
  children,
  api,
  queryClient,
}: {
  children: ReactNode;
  api?: BoundApi;
  queryClient?: QueryClient;
}) {
  const [defaultQueryClient] = useState(createTestQueryClient);
  const [defaultApi] = useState(makeGeminiApi);
  return (
    <QueryClientProvider client={queryClient ?? defaultQueryClient}>
      <ApiProvider value={api ?? defaultApi}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>
            <FooterProvider initialShortcuts={[]}>{children}</FooterProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
