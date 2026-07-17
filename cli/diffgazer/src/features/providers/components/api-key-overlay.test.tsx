import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { ApiKeyOverlay } from "./api-key-overlay";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

function Wrapper({ children, api }: { children: ReactNode; api: BoundApi }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>{children}</TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

describe("ApiKeyOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  test("saves via keyboard Enter on the focused Save button without passing secrets to onSaved", async () => {
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveConfig } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="gemini" onOpenChange={() => {}} onSaved={onSaved} />
      </Wrapper>,
    );

    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-test-secret");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onSaved.mock.calls.length > 0);

    expect(saveConfig).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: { kind: "literal", value: "sk-test-secret" },
    });
    expect(onSaved).toHaveBeenCalledWith();
    expect(onSaved.mock.calls[0]?.length ?? 0).toBe(0);
  });

  test("ignores footer arrows while the key input is focused so Enter submits instead of cancelling", async () => {
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveConfig } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="gemini" onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    // Tab focuses the input; → must not move focus to Cancel while typing (F-347b).
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-typed-key");
    await flush();
    view.stdin.write("[C"); // right arrow
    await flush();
    view.stdin.write("\r"); // Enter
    await waitUntil(() => onOpenChange.mock.calls.length > 0);

    expect(saveConfig).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: { kind: "literal", value: "sk-typed-key" },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("saves once when Enter follows Cancel selection and input focus", async () => {
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveConfig } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="gemini" onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    view.stdin.write("\u001B[C");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-cancel-then-save");
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onOpenChange.mock.calls.length > 0);

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: { kind: "literal", value: "sk-cancel-then-save" },
    });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("clears typed secrets when the overlay closes", async () => {
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveConfig } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="gemini" onOpenChange={() => {}} />
      </Wrapper>,
    );

    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-visible-secret");
    await flush();

    view.rerender(
      <Wrapper api={api}>
        <ApiKeyOverlay open={false} providerId="gemini" onOpenChange={() => {}} />
      </Wrapper>,
    );
    await flush();

    view.rerender(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="gemini" onOpenChange={() => {}} />
      </Wrapper>,
    );
    await flush();

    const frame = view.lastFrame() ?? "";
    expect(frame).not.toContain("sk-visible-secret");
    expect(frame).not.toContain("*".repeat("sk-visible-secret".length));
  });

  test("clears typed secrets when the provider changes while open", async () => {
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveConfig } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="gemini" onOpenChange={() => {}} />
      </Wrapper>,
    );

    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-provider-secret");
    await flush();

    view.rerender(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="openrouter" onOpenChange={() => {}} />
      </Wrapper>,
    );
    await flush();

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("Configure API Key");
    expect(frame).toContain("openrouter");
    expect(frame).not.toContain("sk-provider-secret");
    expect(frame).not.toContain("*".repeat("sk-provider-secret".length));
  });

  test("keeps a pasted secret out of the fixed environment-variable credential", async () => {
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveConfig } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="gemini" onOpenChange={() => {}} />
      </Wrapper>,
    );

    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-never-an-env-name");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\u001B[B");
    await flush();

    const envFrame = view.lastFrame() ?? "";
    expect(envFrame).toContain("GOOGLE_API_KEY");
    expect(envFrame).toContain("Fixed for this provider");
    expect(envFrame).not.toContain("sk-never-an-env-name");
    expect(envFrame).not.toContain("*".repeat("sk-never-an-env-name".length));

    view.stdin.write("\t");
    view.stdin.write("ATTACKER_VAR");
    await flush();
    expect(view.lastFrame()).not.toContain("ATTACKER_VAR");

    view.stdin.write("\r");
    await flush(8);

    expect(saveConfig).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: { kind: "env", varName: "GOOGLE_API_KEY" },
    });
  });

  test("ignores close requests during a deferred save and closes after a failed save settles", async () => {
    let rejectSave: ((reason: Error) => void) | undefined;
    const saveConfig = vi.fn<BoundApi["saveConfig"]>(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    const onOpenChange = vi.fn();
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveConfig } satisfies BoundApi;

    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay open providerId="gemini" onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-pending-secret");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
    await flush();

    expect(view.lastFrame()).toContain("Saving...");
    view.stdin.write("\u001B");
    await flush();

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(view.lastFrame()).toContain("Saving...");

    rejectSave?.(new Error("save rejected"));
    await waitUntil(() => {
      const frame = view.lastFrame() ?? "";
      return (
        frame.includes("save rejected") &&
        !frame.includes("Saving...") &&
        frame.includes("Save") &&
        frame.includes("Cancel")
      );
    });

    expect(view.lastFrame()).toContain("save rejected");
    expect(onOpenChange).not.toHaveBeenCalled();
    view.stdin.write("\u001B");
    await waitUntil(() => onOpenChange.mock.calls.length > 0);

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
