import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { ConfigurationModelsResponse } from "@diffgazer/core/schemas/config";
import { DEFAULT_SETTINGS } from "@diffgazer/core/schemas/config";
import {
  GEMINI_CONFIGURATION,
  makeAllConfigurationsListResponse,
} from "@diffgazer/core/testing/provider-fixtures";
import { QueryClientProvider } from "@tanstack/react-query";
import { Text } from "ink";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation";
import { useNavigation } from "../../../hooks/use-navigation";
import { flush } from "../../../testing/flush";
import { createTestQueryClient } from "../../../testing/query-client";
import type { RootFrameView } from "../../../testing/render-root-frame";
import { CliThemeProvider } from "../../../theme/provider";
import { ProvidersScreen } from "../components/screen";

export const TAB = "\t";
export const ENTER = "\r";
export const ESCAPE = "\u001b";
export const ARROW_RIGHT = "\u001b[C";
export const ARROW_LEFT = "\u001b[D";
export const ARROW_DOWN = "\u001b[B";
export const ARROW_UP = "\u001b[A";

export async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for condition after ${attempts} attempts`);
}

export async function pressRoot(view: RootFrameView, input: string): Promise<void> {
  view.stdin.write(input);
  await flush();
}

export async function flushUntilRoot(predicate: () => boolean, attempts = 500): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`Timed out waiting for root frame condition after ${attempts} attempts`);
}

function geminiCatalogModelsResponse(): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: GEMINI_CONFIGURATION.configurationId,
    productId: GEMINI_CONFIGURATION.productId,
    transportFamily: GEMINI_CONFIGURATION.transportFamily,
    models: [
      {
        id: "gemini-2.5-flash",
        name: "gemini-2.5-flash",
        description: "1M context",
        tier: "paid",
      },
    ],
    checkedAt: "2026-07-31T12:00:00.000Z",
    source: "snapshot",
    cached: false,
  };
}

const RECORDED_CONSENT_SETTINGS = {
  ...DEFAULT_SETTINGS,
  providerConsent: { version: 1 as const, acceptedAt: "2026-08-01T09:00:00.000Z" },
};

export function makeApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    // Consent is on record in the steady state; the first-run test overrides it.
    getSettings: vi.fn<BoundApi["getSettings"]>().mockResolvedValue(RECORDED_CONSENT_SETTINGS),
    listConfigurations: vi
      .fn<BoundApi["listConfigurations"]>()
      .mockResolvedValue(makeAllConfigurationsListResponse()),
    createConfiguration: vi.fn(),
    updateConfiguration: vi.fn(),
    selectConfiguration: vi.fn(),
    deleteConfiguration: vi.fn(),
    inspectConfiguration: vi.fn(),
    // Model discovery is a real query: an undefined resolution makes React
    // Query throw and the dialog renders an error footer instead of its list.
    getConfigurationModels: vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(geminiCatalogModelsResponse()),
  } satisfies BoundApi;
}

export function Wrapper({
  children,
  api,
  initialRoute = { screen: "settings/providers" },
}: {
  children: ReactNode;
  api?: BoundApi;
  initialRoute?: Parameters<typeof NavigationProvider>[0]["initialRoute"];
}) {
  const boundApi = api ?? makeApi();
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <ApiProvider value={boundApi}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>
            <NavigationProvider initialRoute={initialRoute}>
              <FooterProvider initialShortcuts={[]}>{children}</FooterProvider>
            </NavigationProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

export function FooterProbe() {
  const { shortcuts, rightShortcuts } = useFooterData();
  const format = (list: typeof shortcuts) =>
    list.map((shortcut) => `[${shortcut.key}] ${shortcut.label}`).join(" ");
  return <Text>{`FOOTER ${format(shortcuts)} | ${format(rightShortcuts)}`}</Text>;
}

export function RouteProbe() {
  const { route } = useNavigation();
  return <Text>{`route:${route.screen}`}</Text>;
}

export function ProvidersApiBoundary({ api }: { api: BoundApi }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>
            <FooterProvider initialShortcuts={[]}>
              <ProvidersScreen />
            </FooterProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
