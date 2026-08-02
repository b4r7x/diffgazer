import "./model-select-overlay.terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationActionResponse,
  ClientConfigurationSummary,
  Readiness,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { escapeRegExp } from "../../../testing/escape-regexp";
import { CliThemeProvider } from "../../../theme/provider";
import { makeConfigurationListResponse, READY_GEMINI_CONFIGURATION } from "../testing/fixtures";

export const ARROW_DOWN = "\u001b[B";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;
type TestConfigurationResponse = Extract<ClientConfigurationActionResponse, { action: "test" }>;

export const CHECKED_AT = "2026-07-31T12:00:00.000Z";

export function copyNotice(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
}

export function readyFor(productId: RunnableProductId): Extract<Readiness, { status: "ready" }> {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return {
    status: "ready",
    ready: true,
    evidenceStatus: "passed",
    checkedAt: CHECKED_AT,
    acknowledgement: {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: CHECKED_AT,
    },
    action: "inspect",
    explanation: "The exact configured review path is ready.",
    remediation: { code: "none", message: "No remediation is required." },
  };
}

export function testDiscoveryResponse(
  configuration: SupportedConfigurationSummary,
  readiness: Readiness = readyFor(configuration.productId),
  status: TestConfigurationResponse["status"] = "succeeded",
): TestConfigurationResponse {
  return { action: "test", status, configuration, readiness };
}

export const GEMINI_CONFIGURATION = READY_GEMINI_CONFIGURATION;

export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-flash",
    name: "gemini-2.5-flash",
    description: "Exact credentialed production-path evidence passed.",
    tier: "paid" as const,
  },
];

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

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

export function makeGeminiApi(): BoundApi {
  const listConfigurations = vi
    .fn<BoundApi["listConfigurations"]>()
    .mockResolvedValue(makeConfigurationListResponse());
  const testConfiguration = vi
    .fn<BoundApi["testConfiguration"]>()
    .mockResolvedValue(testDiscoveryResponse(GEMINI_CONFIGURATION));
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    listConfigurations,
    testConfiguration,
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
  const [defaultQueryClient] = useState(makeQueryClient);
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
