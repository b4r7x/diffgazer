import type { ProviderListRow } from "@diffgazer/core/providers";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import { buildProviderRows } from "@diffgazer/core/testing/provider-fixtures";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { getProviderActions } from "../lib/actions";
import { ProviderDetails, type ProviderDetailsProps } from "./details";

const ROWS = buildProviderRows();

function findRow(configurationId: string): ProviderListRow {
  const row = ROWS.find(
    (candidate) => candidate.configuration?.configurationId === configurationId,
  );
  if (!row) throw new Error(`Missing fixture row: ${configurationId}`);
  return row;
}

const GEMINI_ROW = findRow("gemini-primary");

function renderDetails(
  row: ProviderListRow | null,
  props: Pick<ProviderDetailsProps, "isPending" | "focusFallbackRef"> = {},
) {
  const onAction = vi.fn();
  const view = render(
    <ProviderDetails row={row} actions={getProviderActions(row)} onAction={onAction} {...props} />,
  );
  return { ...view, onAction };
}

function buttonNames(): string[] {
  return screen.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? "");
}

describe("ProviderDetails", () => {
  it("renders one action row with no repeated accessible name", () => {
    renderDetails(GEMINI_ROW);

    const names = buttonNames();
    expect(screen.getAllByRole("group", { name: "Provider actions" })).toHaveLength(1);
    expect(names).toEqual(getProviderActions(GEMINI_ROW).map((action) => action.label));
    expect(new Set(names).size).toBe(names.length);
  });

  it("announces why a listed action cannot run through its accessible name", () => {
    const readyRow = findRow("zai-primary");
    renderDetails({ ...readyRow, actions: ["inspect", "test", "update", "delete"] });

    const select = screen.getByRole("button", {
      name: "Select configuration. Selection is not available",
    });
    expect(select).toBeDisabled();
  });

  it("places the destructive action last", () => {
    renderDetails(GEMINI_ROW);

    const names = buttonNames();
    expect(names.at(-1)).toBe("Delete configuration");
  });

  it("routes the primary action through the supplied handler", async () => {
    const user = userEvent.setup();
    const { onAction } = renderDetails(GEMINI_ROW);

    await user.click(screen.getByRole("button", { name: "Select configuration" }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "selectConfiguration" }));
  });

  it("shows the readiness guidance as a callout below the action row", () => {
    renderDetails(GEMINI_ROW);

    const firstAction = screen.getAllByRole("button")[0];
    const callout = screen.getByText(GEMINI_ROW.readiness.explanation);
    if (!firstAction) throw new Error("Expected an action button");

    expect(
      firstAction.compareDocumentPosition(callout) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Readiness")).not.toBeInTheDocument();
    expect(screen.queryByText(/Available actions/i)).not.toBeInTheDocument();
  });

  it("renders every settings row the core builder produces except readiness", () => {
    renderDetails(GEMINI_ROW);

    const rendered = buildProviderSettingsRows(GEMINI_ROW).filter(({ id }) => id !== "readiness");
    expect(rendered.length).toBeGreaterThan(0);
    for (const { label } of rendered) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("attaches each description to its own row and keeps the value scalar", () => {
    renderDetails(GEMINI_ROW);

    const description = screen.getByText(GEMINI_ROW.product.description);
    const productLabel = screen.getByText("Product");
    expect(description.closest("div")).toBe(productLabel.closest("div"));
    expect(screen.getByText(GEMINI_ROW.product.name, { selector: "dd" })).toBeInTheDocument();
  });

  it("publishes the display-status tone on the status readout", () => {
    renderDetails(GEMINI_ROW);

    expect(screen.getByRole("status", { name: /Ready\./i })).toHaveAttribute(
      "data-tone",
      "success",
    );
  });

  it("shows CLI unsupported evidence for unsupported CLI rows", () => {
    renderDetails(findRow("codex-cli-1"));

    expect(screen.getByLabelText(/CLI unsupported\./i)).toBeInTheDocument();
  });

  it("prompts to select a provider when none is provided", () => {
    renderDetails(null);

    expect(screen.getByText(/select a provider to view details/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("disables every provider action while a mutation is pending", () => {
    renderDetails(GEMINI_ROW, { isPending: true });

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("parks programmatic focus on the details content through the fallback ref", () => {
    const focusFallbackRef = createRef<HTMLDivElement>();
    renderDetails(GEMINI_ROW, { isPending: true, focusFallbackRef });

    // The keyboard row focuses this element while every action is disabled; it must
    // accept programmatic focus without joining the tab order.
    focusFallbackRef.current?.focus();
    expect(focusFallbackRef.current).toHaveFocus();
    expect(focusFallbackRef.current).toHaveAttribute("tabindex", "-1");
  });
});
