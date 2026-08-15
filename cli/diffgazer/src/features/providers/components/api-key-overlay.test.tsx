import "../testing/terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ProviderListRow } from "@diffgazer/core/providers";
import type {
  ClientConfigurationInput,
  ReadinessAcknowledgement,
} from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import {
  buildProviderRows,
  configurationStatus,
  LOCAL_OPENAI_CONFIGURATION,
  unconfiguredRow,
} from "@diffgazer/core/testing/provider-fixtures";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { flush } from "../../../testing/flush";
import { createTestQueryClient } from "../../../testing/query-client";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { flushUntil } from "../testing/model-select-overlay";
import { ApiKeyOverlay } from "./api-key-overlay";

function Wrapper({ children, api }: { children: ReactNode; api: BoundApi }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme="dark">
          <TerminalKeyboardProvider>
            <FooterProvider initialShortcuts={[]}>{children}</FooterProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function hostedRow(): ProviderListRow {
  return requireValue(
    buildProviderRows().find((row) => row.product.productId === "gemini"),
    "gemini row",
  );
}

function localRow(): ProviderListRow {
  return requireValue(
    buildProviderRows().find((row) => row.configuration?.configurationId === "local-openai-1"),
    "local-openai-1 row",
  );
}

/** A stored configuration whose current notice has not been accepted yet. */
function unacknowledgedLocalRow(): ProviderListRow {
  const rows = buildProviderRows([
    configurationStatus(LOCAL_OPENAI_CONFIGURATION, "acknowledgement-required"),
  ]);
  return requireValue(
    rows.find((row) => row.configuration?.configurationId === "local-openai-1"),
    "local-openai-1 row",
  );
}

describe("ApiKeyOverlay hosted write-only flow", () => {
  afterEach(() => {
    cleanup();
  });

  test("saves via keyboard Enter without passing secrets to onCreate callbacks", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const api = { ...createApi({ baseUrl: "http://localhost" }) } satisfies BoundApi;
    const row = unconfiguredRow("gemini");

    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={() => {}}
          onCreate={onCreate}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    view.stdin.write("a");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-test-secret");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        transportFamily: "hosted-api",
        productId: "gemini",
        credential: { kind: "literal", value: "sk-test-secret" },
      }),
      expect.anything(),
    );
    expect(view.lastFrame()).not.toContain("sk-test-secret");
  });

  test("does not toggle notice acceptance while typing in the API key field", async () => {
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={unconfiguredRow("gemini")}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    view.stdin.write("a");
    await flush();
    expect(view.lastFrame()).toContain("[x]");

    view.stdin.write("\t");
    await flush();
    view.stdin.write("a");
    await flush();
    expect(view.lastFrame()).toContain("[x]");
    expect(view.lastFrame()).toContain("Notice accepted");
  });

  test("submits environment credentials without exposing a typed secret in the frame", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const api = { ...createApi({ baseUrl: "http://localhost" }) } satisfies BoundApi;
    const row = unconfiguredRow("gemini");
    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={() => {}}
          onCreate={onCreate}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    view.stdin.write("a");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-never-an-env-name");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\u001B[B");
    await flush();
    expect(view.lastFrame()).not.toContain("sk-never-an-env-name");
    view.stdin.write("\r");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate).toHaveBeenCalled();
    const input = onCreate.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      transportFamily: "hosted-api",
      productId: "gemini",
      credential: { kind: "environment" },
    });
  });

  test("clears typed secrets when the overlay closes", async () => {
    const api = { ...createApi({ baseUrl: "http://localhost" }) } satisfies BoundApi;
    const row = hostedRow();
    const view = render(
      <Wrapper api={api}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Update Configuration") ?? false);
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-visible-secret");
    await flush();

    view.rerender(
      <Wrapper api={api}>
        <ApiKeyOverlay
          open={false}
          row={row}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );
    await flush();
    view.rerender(
      <Wrapper api={api}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );
    await flush();

    const frame = view.lastFrame() ?? "";
    expect(frame).not.toContain("sk-visible-secret");
  });
});

describe("ApiKeyOverlay family-specific layout", () => {
  afterEach(() => {
    cleanup();
  });

  test("forbids local credential controls for local-http setup", async () => {
    const row = localRow();
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(
      () => view.lastFrame()?.includes("without storing hosted credentials") ?? false,
    );
    const frame = view.lastFrame() ?? "";
    expect(frame).toContain(LOCAL_OPENAI_CONFIGURATION.endpoint);
    expect(frame).not.toContain("Paste API key directly");
    expect(frame).not.toContain("sk-");
  });

  test("forbids credential controls for local-cli setup", async () => {
    const row = requireValue(
      buildProviderRows().find((entry) => entry.product.productId === "codex-cli"),
      "codex-cli row",
    );
    expect(row.configuration).toMatchObject({
      status: "supported",
      transportFamily: "local-cli",
    });
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Update Configuration") ?? false);
    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("OpenAI Codex CLI");
    expect(frame).not.toContain("Paste API key directly");
    expect(frame).not.toContain("Use environment variable");
  });

  test("requires explicit notice acknowledgement before hosted save", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const row = unconfiguredRow("gemini");
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={() => {}}
          onCreate={onCreate}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-hosted-secret");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
    await flush();
    expect(onCreate).not.toHaveBeenCalled();

    view.stdin.write("a");
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onCreate.mock.calls.length > 0);
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        transportFamily: "hosted-api",
        productId: "gemini",
        credential: { kind: "literal", value: "sk-hosted-secret" },
      }),
      expect.objectContaining({
        acknowledgement: expect.objectContaining({ status: "accepted" }),
      }),
    );
  });
});

describe("ApiKeyOverlay notice acknowledgement state", () => {
  afterEach(() => {
    cleanup();
  });

  test("saves an update on a stored acceptance without re-accepting the notice", async () => {
    const onUpdate = vi.fn(
      async (_payload: {
        input: ClientConfigurationInput;
        acknowledgement: ReadinessAcknowledgement;
      }) => {},
    );
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={hostedRow()}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={onUpdate}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Update Configuration") ?? false);
    expect(view.lastFrame()).toContain("Notice accepted");

    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-rotated-key");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onUpdate.mock.calls.length > 0);

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate.mock.calls[0]?.[0]).toMatchObject({
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        credential: { kind: "literal", value: "sk-rotated-key" },
      },
      acknowledgement: { status: "accepted" },
    });
  });

  test("requires acceptance when the row carries no stored acknowledgement", async () => {
    const onUpdate = vi.fn(
      async (_payload: {
        input: ClientConfigurationInput;
        acknowledgement: ReadinessAcknowledgement;
      }) => {},
    );
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={unacknowledgedLocalRow()}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={onUpdate}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Accept notice") ?? false);

    view.stdin.write("\r");
    await flush();
    expect(view.lastFrame()).toContain("Notice accepted");

    view.stdin.write("\r");
    await waitUntil(() => onUpdate.mock.calls.length > 0);
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  test("accepts the notice with Enter on the focused notice button", async () => {
    const onCreate = vi.fn(
      async (
        _input: ClientConfigurationInput,
        _opts: { acknowledgement: ReadinessAcknowledgement; openModelDialog?: boolean },
      ) => {},
    );
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={unconfiguredRow("ollama")}
          onOpenChange={() => {}}
          onCreate={onCreate}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    expect(view.lastFrame()).toContain("Accept notice");

    view.stdin.write("\r");
    await flush();
    expect(view.lastFrame()).toContain("Notice accepted");

    view.stdin.write("\r");
    await waitUntil(() => onCreate.mock.calls.length > 0);
    expect(onCreate).toHaveBeenCalledOnce();
  });

  test("shows the canonical environment variable for hosted setup", async () => {
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={unconfiguredRow("gemini")}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    view.stdin.write("\u001B[B");
    await flush();

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("GOOGLE_API_KEY");
    expect(frame).not.toContain("GEMINI_API_KEY");
    expect(frame).toContain("Fixed for this provider");
  });

  test("surfaces rejected local saves inline instead of closing the overlay", async () => {
    const onUpdate = vi.fn(
      async (_payload: {
        input: ClientConfigurationInput;
        acknowledgement: ReadinessAcknowledgement;
      }) => {
        throw new Error("Local endpoint unreachable");
      },
    );
    const onOpenChange = vi.fn();
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={unacknowledgedLocalRow()}
          onOpenChange={onOpenChange}
          onCreate={async () => {}}
          onUpdate={onUpdate}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Update Configuration") ?? false);
    view.stdin.write("a");
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => (view.lastFrame() ?? "").includes("Local endpoint unreachable"));

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
