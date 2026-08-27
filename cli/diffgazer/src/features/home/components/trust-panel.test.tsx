import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Footer } from "../../../components/layout/footer";
import { flush } from "../../../testing/flush";
import { CliThemeProvider } from "../../../theme/provider";
import { TrustPanel } from "./trust-panel";

function makeInitResponse(): ConfigurationInitResponse {
  return {
    schemaVersion: 2,
    configurations: [],
    unrecognizedConfigurations: [],
    selectedConfigurationId: null,
    settings: {
      theme: "dark",
      defaultLenses: [],
      effectiveCallTokenCap: 49_152,
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: "file",
      agentExecution: "sequential",
      providerConsent: null,
    },
    project: {
      projectId: "project-1",
      path: "/tmp/repo",
      trust: null,
    },
  };
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

const ARROW_DOWN = "\u001b[B";
const ARROW_UP = "\u001b[A";

describe("TrustPanel", () => {
  afterEach(() => {
    cleanup();
  });

  test("moves between the permission list and the accept button with the arrows", async () => {
    const loadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockResolvedValue(makeInitResponse());
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      loadConfigurationInit,
    } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <TrustPanel onAccept={() => {}} />
      </Wrapper>,
    );

    await flushUntil(() => /currently unavailable/i.test(view.lastFrame() ?? ""));
    expect(view.lastFrame()).toContain("[↓/Tab] Focus Actions");

    view.stdin.write(ARROW_DOWN);
    await flush();
    expect(view.lastFrame()).toContain("[↑/Tab] Focus Permissions");

    view.stdin.write(ARROW_UP);
    await flush();
    expect(view.lastFrame()).toContain("[↓/Tab] Focus Actions");

    view.stdin.write(" ");
    await flush();
    expect(view.lastFrame()).toContain("[ ]");
  });

  test("marks runCommands unavailable and never submits it when accepting trust", async () => {
    const loadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockResolvedValue(makeInitResponse());
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
      loadConfigurationInit,
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
    expect(frame).toContain("[\u2193/Tab] Focus Actions");
    expect(frame).toContain("[Enter/Space] Toggle");

    view.stdin.write("\t");
    await flush();
    expect(view.lastFrame()).toContain("[Enter] Trust & Continue");
    expect(view.lastFrame()).toContain("[\u2191/Tab] Focus Permissions");
    view.stdin.write("\r");
    await flushUntil(() => {
      const pendingFrame = view.lastFrame() ?? "";
      return (
        pendingFrame.includes("Saving...") &&
        !pendingFrame.includes("[\u2191/Tab] Focus Permissions")
      );
    });

    expect(view.lastFrame()).not.toContain("[\u2191/Tab] Focus Permissions");
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
    const loadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockResolvedValue(makeInitResponse());
    const saveTrust = vi
      .fn<BoundApi["saveTrust"]>()
      .mockRejectedValue(new Error("Trust save failed\x1b[31m: disk full\x1b[0m"));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      loadConfigurationInit,
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
    const loadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockResolvedValue(makeInitResponse());
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      loadConfigurationInit,
    } satisfies BoundApi;

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
