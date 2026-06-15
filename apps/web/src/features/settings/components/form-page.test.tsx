import type { UseActionRowNavigationReturn } from "@diffgazer/keys";
import type { UseQueryResult } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsFormPage } from "./form-page";

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

function renderShell(query: UseQueryResult<unknown>) {
  return render(
    <SettingsFormPage
      title="Test Settings"
      subtitle="A subtitle"
      query={query}
      footer={stubFooter}
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
});
