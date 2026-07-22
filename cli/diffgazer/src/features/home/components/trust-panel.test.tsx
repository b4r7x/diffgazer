import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Footer } from "../../../components/layout/footer";
import { CliThemeProvider } from "../../../theme/provider";
import { TrustPanel } from "./trust-panel";

function makeInitResponse(): Awaited<ReturnType<BoundApi["loadInit"]>> {
  return {
    configPath: "/tmp/diffgazer/config.json",
    config: null,
    providers: [],
    settings: {
      theme: "dark",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: "file",
      agentExecution: "sequential",
    },
    configured: true,
    project: {
      projectId: "project-1",
      path: "/tmp/repo",
      trust: null,
    },
    setup: {
      hasSecretsStorage: true,
      hasProvider: false,
      hasModel: false,
      hasTrust: false,
      isConfigured: true,
      isReady: false,
      missing: ["provider", "model", "trust"],
    },
  };
}

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function Wrapper({ children, api }: { children: ReactNode; api: BoundApi }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme="dark">
          <FooterProvider initialShortcuts={[]}>
            {children}
            <FooterConsumer />
          </FooterProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function FooterConsumer() {
  const footer = useFooterData();
  return <Footer shortcuts={footer.shortcuts} rightShortcuts={footer.rightShortcuts} />;
}

describe("TrustPanel", () => {
  afterEach(() => {
    cleanup();
  });

  test("marks runCommands unavailable and never submits it when accepting trust", async () => {
    const loadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse());
    const saveResponse: Awaited<ReturnType<BoundApi["saveTrust"]>> = {
      trust: {
        projectId: "project-1",
        repoRoot: "/tmp/repo",
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      },
    };
    let resolveSaveTrust!: (value: typeof saveResponse) => void;
    const saveTrust = vi.fn<BoundApi["saveTrust"]>().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSaveTrust = resolve;
        }),
    );
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      loadInit,
      saveTrust,
    } satisfies BoundApi;
    const onAccept = vi.fn();

    const view = render(
      <Wrapper api={api}>
        <TrustPanel onAccept={onAccept} />
      </Wrapper>,
    );

    await flushUntil(() => /currently unavailable/i.test(view.lastFrame() ?? ""));

    const frame = view.lastFrame() ?? "";
    expect(frame).toMatch(/currently unavailable/i);
    expect(frame).not.toContain("First-Time Setup");
    expect(frame).toContain("[Tab] Focus Actions");
    expect(frame).toContain("[Enter/Space] Toggle");

    view.stdin.write("\t");
    await flush();
    expect(view.lastFrame()).toContain("[Enter] Trust & Continue");
    expect(view.lastFrame()).toContain("[Tab] Focus Permissions");
    view.stdin.write("\r");
    await flushUntil(() => {
      const pendingFrame = view.lastFrame() ?? "";
      return (
        pendingFrame.includes("Saving...") && !pendingFrame.includes("[Tab] Focus Permissions")
      );
    });

    expect(view.lastFrame()).not.toContain("[Tab] Focus Permissions");
    expect(view.lastFrame()).not.toContain("[Enter] Saving...");

    resolveSaveTrust(saveResponse);
    await flushUntil(() => onAccept.mock.calls.length > 0);

    expect(saveTrust).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: { readFiles: true, runCommands: false },
      }),
    );
    expect(onAccept).toHaveBeenCalled();
  });

  test("keeps the sanitized failure message visible and skips onAccept when saveTrust rejects", async () => {
    const loadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse());
    const saveTrust = vi
      .fn<BoundApi["saveTrust"]>()
      .mockRejectedValue(new Error("Trust save failed\x1b[31m: disk full\x1b[0m"));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      loadInit,
      saveTrust,
    } satisfies BoundApi;
    const onAccept = vi.fn();

    const view = render(
      <Wrapper api={api}>
        <TrustPanel onAccept={onAccept} />
      </Wrapper>,
    );

    await flushUntil(() => /currently unavailable/i.test(view.lastFrame() ?? ""));

    view.stdin.write("\t");
    await flush();
    expect(view.lastFrame()).toContain("[Enter] Trust & Continue");

    view.stdin.write("\r");
    await flushUntil(() => (view.lastFrame() ?? "").includes("Trust save failed: disk full"));

    await flush();
    expect(view.lastFrame()).toContain("Trust save failed: disk full");
    expect(onAccept).not.toHaveBeenCalled();
  });

  test.each([
    { keyName: "Enter", input: "\r" },
    { keyName: "Space", input: " " },
  ])("toggles readFiles with $keyName while the capability list is focused", async ({ input }) => {
    const loadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse());
    const api = { ...createApi({ baseUrl: "http://localhost" }), loadInit } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <TrustPanel onAccept={() => {}} />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("[x]") ?? false);
    expect(view.lastFrame()).toContain("[x]");

    view.stdin.write(input);
    await flush();

    expect(view.lastFrame()).toContain("[ ]");
  });
});
