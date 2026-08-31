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
  configuredRow,
  GEMINI_CONFIGURATION,
  OPENCODE_GO_CONFIGURATION,
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
import { setTestTerminalDimensions } from "../testing/terminal-mock";
import { ApiKeyOverlay } from "./api-key-overlay";

const ARROW_DOWN = "\u001B[B";
const ARROW_UP = "\u001B[A";

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

/** A hosted configuration whose current notice has not been accepted yet. */
function unacknowledgedHostedRow(): ProviderListRow {
  const rows = buildProviderRows([
    configurationStatus(GEMINI_CONFIGURATION, "acknowledgement-required"),
  ]);
  return requireValue(
    rows.find((row) => row.configuration?.configurationId === "gemini-primary"),
    "gemini-primary row",
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
          row={unacknowledgedHostedRow()}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Update Configuration") ?? false);
    view.stdin.write("a");
    await flush();
    expect(view.lastFrame()).toContain("[x]");

    view.stdin.write("\t");
    await flush();
    view.stdin.write("a");
    await flush();
    expect(view.lastFrame()).toContain("[x] I accept");
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
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-never-an-env-name");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
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

describe("ApiKeyOverlay endpoint binding", () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * Measured height of the opencode create card: 30 rows show the whole body,
   * and 26 are already needed without the endpoint control because the product
   * notice wraps to six lines — the card overflowed the support floor before
   * this control existed. Cases that assert body content render tall; the 80x24
   * floor has its own case below.
   */
  const FULL_BODY_ROWS = 30;
  const SUPPORT_FLOOR_ROWS = 24;

  function renderOverlay(
    row: ProviderListRow,
    handlers: {
      onCreate?: (input: ClientConfigurationInput) => Promise<void>;
      onUpdate?: (payload: {
        input: ClientConfigurationInput;
        acknowledgement: ReadinessAcknowledgement;
      }) => Promise<void>;
    } = {},
    rows = FULL_BODY_ROWS,
  ) {
    setTestTerminalDimensions({ columns: 80, rows });
    return render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={() => {}}
          onCreate={handlers.onCreate ?? (async () => {})}
          onUpdate={handlers.onUpdate ?? (async () => {})}
        />
      </Wrapper>,
    );
  }

  async function typeKeyAndSave(view: ReturnType<typeof render>, key: string) {
    view.stdin.write("\t");
    await flush();
    view.stdin.write(key);
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
  }

  /**
   * Arrows down through the endpoint group into the method radios, commits the
   * env method with Space (so Enter can save without a typed key), then arrows
   * back up into the endpoint zone. Leaves the highlight on the second pool.
   */
  async function selectEnvMethodAndReturnToEndpoint(view: ReturnType<typeof render>) {
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
    await flush();
    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write(ARROW_UP);
    await flush();
  }

  test("keeps the title and the Save action on screen at the 80x24 support floor", async () => {
    const view = renderOverlay(unconfiguredRow("opencode-zen"), {}, SUPPORT_FLOOR_ROWS);
    await flushUntil(() => view.lastFrame()?.includes("OpenCode Zen") ?? false);

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("Create Configuration");
    expect(frame).toContain("Save");
  });

  test("names both billing pools when creating on a multi-endpoint product", async () => {
    const view = renderOverlay(unconfiguredRow("opencode-zen"));
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("Endpoint profile:");
    expect(frame).toContain("https://opencode.ai/zen/v1");
    expect(frame).toContain("https://opencode.ai/zen/go/v1");
  });

  test("binds the first profile when the endpoint choice is left untouched", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const view = renderOverlay(unconfiguredRow("opencode-zen"), { onCreate });
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);

    await typeKeyAndSave(view, "sk-zen-key");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      productId: "opencode-zen",
      endpoint: "https://opencode.ai/zen/v1",
    });
  });

  test("keeps the first profile bound when arrows only pass through the group", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const view = renderOverlay(unconfiguredRow("opencode-zen"), { onCreate });
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    // The overlay enters its first zone in a mount effect, one commit after the
    // first frame; keys written before that land on an unfocused group.
    await flush();

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    expect(view.lastFrame()).toContain("( * ) OpenCode Zen");

    await typeKeyAndSave(view, "sk-zen-key");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      productId: "opencode-zen",
      endpoint: "https://opencode.ai/zen/v1",
    });
  });

  test("binds the Go pool once Space commits the highlighted profile", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const view = renderOverlay(unconfiguredRow("opencode-zen"), { onCreate });
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    // The overlay enters its first zone in a mount effect, one commit after the
    // first frame; keys written before that land on an unfocused group.
    await flush();

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
    await flush();
    expect(view.lastFrame()).toContain("( * ) OpenCode Go");

    await typeKeyAndSave(view, "sk-go-key");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      productId: "opencode-zen",
      endpoint: "https://opencode.ai/zen/go/v1",
    });
  });

  test("keeps the first pool bound when Enter saves over an uncommitted highlight", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const view = renderOverlay(unconfiguredRow("opencode-zen"), { onCreate });
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    // The overlay enters its first zone in a mount effect, one commit after the
    // first frame; keys written before that land on an unfocused group.
    await flush();

    await selectEnvMethodAndReturnToEndpoint(view);
    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    expect(view.lastFrame()).toContain("( * ) OpenCode Zen");

    view.stdin.write("\r");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      productId: "opencode-zen",
      endpoint: "https://opencode.ai/zen/v1",
      credential: { kind: "environment" },
    });
    expect(view.lastFrame()).toContain("( * ) OpenCode Zen");
  });

  test("binds the Go pool when Space commits the highlight before Enter saves", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const view = renderOverlay(unconfiguredRow("opencode-zen"), { onCreate });
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    // The overlay enters its first zone in a mount effect, one commit after the
    // first frame; keys written before that land on an unfocused group.
    await flush();

    await selectEnvMethodAndReturnToEndpoint(view);
    view.stdin.write(" ");
    await flush();
    expect(view.lastFrame()).toContain("( * ) OpenCode Go");

    view.stdin.write("\r");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      productId: "opencode-zen",
      endpoint: "https://opencode.ai/zen/go/v1",
      credential: { kind: "environment" },
    });
  });

  test("offers no endpoint choice on a single-endpoint product", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const view = renderOverlay(unconfiguredRow("deepseek"), { onCreate });
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);
    expect(view.lastFrame()).not.toContain("Endpoint profile:");

    await typeKeyAndSave(view, "sk-deepseek-key");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate.mock.calls[0]?.[0]).toEqual({
      transportFamily: "hosted-api",
      productId: "deepseek",
      endpoint: "https://api.deepseek.com/v1",
      credential: { kind: "literal", value: "sk-deepseek-key" },
    });
  });

  test("keeps the stored pool read-only while re-keying a configuration", async () => {
    const onUpdate = vi.fn(
      async (_payload: {
        input: ClientConfigurationInput;
        acknowledgement: ReadinessAcknowledgement;
      }) => {},
    );
    const view = renderOverlay(configuredRow(OPENCODE_GO_CONFIGURATION), { onUpdate });
    await flushUntil(() => view.lastFrame()?.includes("Update Configuration") ?? false);

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("Endpoint: OpenCode Go");
    expect(frame).not.toContain("Endpoint profile:");

    await typeKeyAndSave(view, "sk-rotated-go-key");
    await waitUntil(() => onUpdate.mock.calls.length > 0);

    expect(onUpdate.mock.calls[0]?.[0]?.input).toMatchObject({
      productId: "opencode-zen",
      endpoint: "https://opencode.ai/zen/go/v1",
    });
  });
});

describe("ApiKeyOverlay notice acknowledgement gate", () => {
  afterEach(() => {
    cleanup();
  });

  test("requires explicit notice acknowledgement before a hosted save when the notice needs accepting again", async () => {
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
          row={unacknowledgedHostedRow()}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={onUpdate}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Update Configuration") ?? false);
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-hosted-secret");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
    await flush();
    expect(onUpdate).not.toHaveBeenCalled();

    view.stdin.write("a");
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onUpdate.mock.calls.length > 0);
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate.mock.calls[0]?.[0]).toMatchObject({
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        credential: { kind: "literal", value: "sk-hosted-secret" },
      },
      acknowledgement: { status: "accepted" },
    });
  });
});

describe("ApiKeyOverlay notice acknowledgement", () => {
  afterEach(() => {
    cleanup();
  });

  test("sends the product acknowledgement without an accept control while the notice is accepted", async () => {
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
    const frame = view.lastFrame() ?? "";
    expect(frame).not.toContain("I accept");
    // The product's own notice still reads informationally.
    expect(frame).toContain("Data handling follows the configured Google API product");

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

  test("asks for an explicit acceptance without repeating the global consent text", async () => {
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={unacknowledgedHostedRow()}
          onOpenChange={() => {}}
          onCreate={async () => {}}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("needs your acceptance") ?? false);
    expect(view.lastFrame()).not.toContain("Diffgazer sends repository content");
    expect(view.lastFrame()).toContain("[ ] I accept");

    view.stdin.write("a");
    await flush();
    expect(view.lastFrame()).toContain("[x] I accept");
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
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
    await flushUntil(() => view.lastFrame()?.includes("GOOGLE_API_KEY") ?? false);

    const frame = view.lastFrame() ?? "";
    expect(frame).toContain("GOOGLE_API_KEY");
    expect(frame).not.toContain("GEMINI_API_KEY");
    expect(frame).toContain("Fixed for this provider");
  });

  test("surfaces rejected saves inline instead of closing the overlay", async () => {
    const onUpdate = vi.fn(
      async (_payload: {
        input: ClientConfigurationInput;
        acknowledgement: ReadinessAcknowledgement;
      }) => {
        throw new Error("Endpoint unreachable");
      },
    );
    const onOpenChange = vi.fn();
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={hostedRow()}
          onOpenChange={onOpenChange}
          onCreate={async () => {}}
          onUpdate={onUpdate}
        />
      </Wrapper>,
    );

    await flushUntil(() => view.lastFrame()?.includes("Update Configuration") ?? false);
    view.stdin.write("\t");
    await flush();
    view.stdin.write("sk-rejected-key");
    await flush();
    view.stdin.write("\t");
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => (view.lastFrame() ?? "").includes("Endpoint unreachable"));

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("ApiKeyOverlay arrow navigation", () => {
  afterEach(() => {
    cleanup();
  });

  function renderOverlay(
    row: ProviderListRow,
    handlers: Partial<{
      onOpenChange: (open: boolean) => void;
      onUpdate: (payload: {
        input: ClientConfigurationInput;
        acknowledgement: ReadinessAcknowledgement;
      }) => Promise<void>;
    }> = {},
  ) {
    return render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={row}
          onOpenChange={handlers.onOpenChange ?? (() => {})}
          onCreate={async () => {}}
          onUpdate={handlers.onUpdate ?? (async () => {})}
        />
      </Wrapper>,
    );
  }

  test("steps down from the method radios into the key field and back up", async () => {
    const view = renderOverlay(unconfiguredRow("gemini"));
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write("sk123");
    await flush();
    expect(view.lastFrame()).toContain("*****");

    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write("xy");
    await flush();
    expect(view.lastFrame()).toContain("*****");
    expect(view.lastFrame()).not.toContain("******");
  });

  test("reaches the acknowledgement from the radios and toggles it with Space", async () => {
    const view = renderOverlay(unacknowledgedHostedRow());
    await flushUntil(() => view.lastFrame()?.includes("[ ] I accept") ?? false);

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
    await flush();
    expect(view.lastFrame()).toContain("[x] I accept");

    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write(" ");
    await flush();
    expect(view.lastFrame()).toContain("[x] I accept");
  });

  test("steps from the acknowledgement into the footer actions and confirms there", async () => {
    const onUpdate = vi.fn(
      async (_payload: {
        input: ClientConfigurationInput;
        acknowledgement: ReadinessAcknowledgement;
      }) => {},
    );
    const view = renderOverlay(unacknowledgedHostedRow(), { onUpdate });
    await flushUntil(() => view.lastFrame()?.includes("[ ] I accept") ?? false);

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onUpdate.mock.calls.length > 0);

    expect(onUpdate.mock.calls[0]?.[0]).toMatchObject({
      input: { credential: { kind: "environment" } },
      acknowledgement: { status: "accepted" },
    });
  });

  test("returns from the footer actions to the acknowledgement", async () => {
    const view = renderOverlay(unacknowledgedHostedRow());
    await flushUntil(() => view.lastFrame()?.includes("[ ] I accept") ?? false);

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(" ");
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write(" ");
    await flush();

    expect(view.lastFrame()).toContain("[ ] I accept");
  });

  test("stops at the first zone instead of wrapping past the method radios", async () => {
    const view = renderOverlay(unconfiguredRow("gemini"));
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);

    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write("sk123");
    await flush();

    expect(view.lastFrame()).toContain("*****");
  });

  test("keeps the pasted key on the arrow route to Save instead of flipping to the env method", async () => {
    const onCreate = vi.fn(async (_input: ClientConfigurationInput) => {});
    const view = render(
      <Wrapper api={createApi({ baseUrl: "http://localhost" })}>
        <ApiKeyOverlay
          open
          row={unconfiguredRow("gemini")}
          onOpenChange={() => {}}
          onCreate={onCreate}
          onUpdate={async () => {}}
        />
      </Wrapper>,
    );
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write("sk-arrow-key");
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onCreate.mock.calls.length > 0);

    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
      credential: { kind: "literal", value: "sk-arrow-key" },
    });
  });

  test("returns from the footer actions to the key field while the paste method is selected", async () => {
    const view = renderOverlay(unconfiguredRow("gemini"));
    await flushUntil(() => view.lastFrame()?.includes("Create Configuration") ?? false);

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write("sk123");
    await flush();
    expect(view.lastFrame()).toContain("*****");
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_UP);
    await flush();
    view.stdin.write("xy");
    await flush();

    expect(view.lastFrame()).toContain("*******");
  });

  test("stops at the footer actions instead of wrapping back to the method radios", async () => {
    const onOpenChange = vi.fn();
    const view = renderOverlay(unacknowledgedHostedRow(), { onOpenChange });
    await flushUntil(() => view.lastFrame()?.includes("[ ] I accept") ?? false);

    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    view.stdin.write("\r");
    await waitUntil(() => onOpenChange.mock.calls.length > 0);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
