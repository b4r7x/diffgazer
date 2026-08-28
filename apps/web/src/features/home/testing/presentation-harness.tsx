import { createApi } from "@diffgazer/core/api";
import { ApiProvider, useProviderConsentGate } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { HomeContextInfo } from "@diffgazer/core/schemas/presentation";
import { KeyboardProvider, useKey } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderResult, render } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { vi } from "vitest";
import { ProviderConsentDialog } from "@/components/shared/provider-consent-dialog";
import {
  HomePagePresentation,
  type HomePagePresentationProps,
} from "@/features/home/components/presentation";
import type { ShutdownResult } from "@/lib/shutdown";
import { FooterView } from "@/testing/footer-view";

type Navigate = HomePagePresentationProps["navigate"];

export function createNavigateMock() {
  const mock = vi.fn<(options: object) => Promise<void>>(() => Promise.resolve());
  const navigate: Navigate = (options) => mock(options);

  return { navigate, mock };
}

export function Wrapper({ children }: { children: ReactNode }) {
  return (
    <FooterProvider>
      <KeyboardProvider>
        {children}
        <Toaster />
      </KeyboardProvider>
    </FooterProvider>
  );
}

export const baseContext: HomeContextInfo = {
  providerName: "openrouter",
  providerModel: "openrouter/test-model",
  trustedDir: "/repo",
};

export function buildProps(
  overrides: Partial<HomePagePresentationProps> = {},
): HomePagePresentationProps {
  return {
    context: baseContext,
    isTrusted: true,
    needsTrust: false,
    repoRoot: "/repo",
    resumableSession: null,
    highlighted: null,
    searchError: undefined,
    onHighlightChange: vi.fn(),
    navigate: createNavigateMock().navigate,
    createReview: vi.fn(async () => ({ reviewId: "rev-new" })),
    refetchActiveSession: vi.fn(async () => ({ status: "read" as const, session: null })),
    requireProviderConsent: (action) => action(),
    clearScopedRouteState: vi.fn(),
    shutdown: vi.fn(async (): Promise<ShutdownResult> => ({ status: "closed" })),
    ...overrides,
  };
}

export function renderPresentation(props: HomePagePresentationProps): RenderResult {
  return render(<HomePagePresentation {...props} />, { wrapper: Wrapper });
}

/** Stands in for the next handler home's declined keys have to reach. */
export function TrustKeyProbe({ onPress }: { onPress: () => void }) {
  useKey("t", onPress, { scope: "home" });
  return null;
}

export function renderPresentationWithApi(props: HomePagePresentationProps): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveTrust: vi.fn(async () => ({
      trust: {
        projectId: "proj-1",
        repoRoot: "/some/repo",
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent" as const,
        trustedAt: "2026-01-01T00:00:00.000Z",
      },
    })),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <HomePagePresentation {...props} />
        <FooterView />
      </ApiProvider>
    </QueryClientProvider>,
    { wrapper: Wrapper },
  );
}

// The real gate and notice, wired the way the app shell wires them, so the
// consent-gated start path runs end to end: r opens the notice, Accept saves
// the consent and continues the held start.
function ConsentGatedHome(props: HomePagePresentationProps) {
  const gate = useProviderConsentGate(null);
  return (
    <>
      <HomePagePresentation {...props} requireProviderConsent={gate.require} />
      <ProviderConsentDialog
        open={gate.isOpen}
        onOpenChange={(open) => {
          if (!open) gate.decline();
        }}
        consent={gate.readBack}
        continues={gate.continues}
        isAccepting={gate.isAccepting}
        error={gate.error}
        onAccept={gate.accept}
      />
    </>
  );
}

export function renderConsentGatedHome(props: HomePagePresentationProps): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveSettings: vi.fn(async () => {}),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <ConsentGatedHome {...props} />
      </ApiProvider>
    </QueryClientProvider>,
    { wrapper: Wrapper },
  );
}

function StrictWrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <Wrapper>{children}</Wrapper>
    </StrictMode>
  );
}

export function renderPresentationStrict(props: HomePagePresentationProps): RenderResult {
  return render(<HomePagePresentation {...props} />, { wrapper: StrictWrapper });
}
