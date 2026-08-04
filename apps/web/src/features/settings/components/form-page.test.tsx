import type { UseActionRowNavigationReturn } from "@diffgazer/keys";
import type { UseQueryResult } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectSingleReticle } from "@/testing/reticle";
import { SettingsFormPage } from "./form-page";

// The focused branch of the reticle selector: a resting panel publishes neither
// this attribute nor corner brackets until focus actually enters it.
const FOCUSED_PANEL = '[data-slot="panel"][data-state="focused"]';

const stubFooter = {
  inActions: false,
  focusedIndex: 0,
  isFocusedActionDisabled: false,
  enterActions: () => null,
  exitActions: () => {},
  reset: () => {},
  getActionProps: () => ({
    ref: () => {},
    "data-action-index": 0,
    onFocus: () => {},
  }),
} as unknown as UseActionRowNavigationReturn;

function makeQuery(overrides: Partial<UseQueryResult<unknown>>): UseQueryResult<unknown> {
  return {
    isLoading: false,
    error: null,
    data: undefined,
    fetchStatus: "idle",
    ...overrides,
  } as UseQueryResult<unknown>;
}

function renderShell(query: UseQueryResult<unknown>, inActions = false) {
  return render(
    <SettingsFormPage
      title="Test Settings"
      subtitle="A subtitle"
      query={query}
      footer={{ ...stubFooter, inActions }}
      isSaving={false}
      canSave={false}
      onCancel={() => {}}
      onSave={() => {}}
    >
      <div>content</div>
    </SettingsFormPage>,
  );
}

describe("SettingsFormPage status semantics", () => {
  it("exposes role=status while the settings query is loading", () => {
    renderShell(makeQuery({ isLoading: true, fetchStatus: "fetching" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading settings...");
  });

  it("exposes role=alert when the settings query errors", () => {
    renderShell(makeQuery({ error: new Error("boom") }));
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
  });

  it("renders the page content once data is available", () => {
    renderShell(makeQuery({ data: { ok: true } }));
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("rests unbracketed until focus enters the panel", async () => {
    const user = userEvent.setup();
    const { container } = renderShell(makeQuery({ data: { ok: true } }));

    expect(container.querySelector(FOCUSED_PANEL)).toBeNull();

    await user.tab();

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expectSingleReticle(container);
  });

  it("keeps the panel bracketed while focus sits in the footer actions", async () => {
    // The actions live inside the panel, so dimming the content must not read
    // as "the keys moved somewhere else".
    const user = userEvent.setup();
    const { container } = renderShell(makeQuery({ data: { ok: true } }), true);

    await user.tab();

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expectSingleReticle(container);
  });
});
