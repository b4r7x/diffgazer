import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  getProviderActionLayout,
  getUnrecognizedConfigurationActionLayout,
} from "@diffgazer/core/providers";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import { buildProviderRows } from "@diffgazer/core/testing/provider-fixtures";
import { Panel } from "@diffgazer/ui/components/panel";
import { FOCUS_OUTLINE_INSET } from "@diffgazer/ui/lib/focus-outline";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useFocusWithin } from "@/hooks/use-focus-within";
import { expectSingleReticle } from "@/testing/reticle";
import { ProviderDetails, type ProviderDetailsProps } from "./details";

const ROWS = buildProviderRows();

function findRow(configurationId: string, rows: ProviderListRow[] = ROWS): ProviderListRow {
  const row = rows.find(
    (candidate) => candidate.configuration?.configurationId === configurationId,
  );
  if (!row) throw new Error(`Missing fixture row: ${configurationId}`);
  return row;
}

const GEMINI_ROW = findRow("gemini-primary");

type HarnessProps = Omit<ProviderDetailsProps, "layout" | "overflowMenu"> & {
  activeConfigurationId?: string | null;
};

/** Owns the More menu the way the page does, so the menu can open and close for real. */
function Harness({ row, unrecognized, activeConfigurationId = null, ...props }: HarnessProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const layout = unrecognized
    ? getUnrecognizedConfigurationActionLayout()
    : getProviderActionLayout(row, activeConfigurationId);
  return (
    <ProviderDetails
      {...props}
      row={row}
      unrecognized={unrecognized}
      layout={layout}
      overflowMenu={{ open: menuOpen, onOpenChange: setMenuOpen }}
    />
  );
}

/** Composes the pane the way the providers page does: the Panel reticle driven by focus within. */
function PanelHarness(props: HarnessProps) {
  const detailsPane = useFocusWithin<HTMLDivElement>();
  return (
    <Panel
      {...detailsPane.props}
      focused={detailsPane.focusWithin}
      as="section"
      aria-label="Provider details"
    >
      <Harness {...props} />
    </Panel>
  );
}

function renderDetails(
  row: ProviderListRow | null,
  props: Partial<Omit<HarnessProps, "row" | "onAction">> = {},
) {
  const onAction = vi.fn();
  const view = render(<Harness row={row} onAction={onAction} {...props} />);
  return { ...view, onAction };
}

function actionRow(): HTMLElement {
  return screen.getByRole("group", { name: "Provider actions" });
}

function buttonNames(): string[] {
  return within(actionRow())
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "");
}

// Landmarks are the page's job (the details pane sits in a labelled section);
// colour contrast is a token contract jsdom cannot compute.
async function expectNoAxeViolations(container: Element) {
  const results = await axeCore.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations).toEqual([]);
}

describe("ProviderDetails", () => {
  it("renders one action row with the primary, one secondary and the More trigger", () => {
    renderDetails(GEMINI_ROW);

    expect(screen.getAllByRole("group", { name: "Provider actions" })).toHaveLength(1);
    expect(buttonNames()).toEqual(["Select configuration", "Change model", "More actions"]);
    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute(
      "aria-haspopup",
      "menu",
    );
  });

  it("swaps the primary for an Active chip on the configuration reviews run with", () => {
    renderDetails(GEMINI_ROW, { activeConfigurationId: "gemini-primary" });

    expect(within(actionRow()).getByText("Active")).toBeInTheDocument();
    expect(buttonNames()).toEqual(["Change model", "More actions"]);
  });

  it("announces why a listed action cannot run through its accessible name", () => {
    const readyRow = findRow("zai-primary");
    renderDetails({ ...readyRow, actions: ["inspect", "test", "update", "delete"] });

    const select = screen.getByRole("button", {
      name: "Select configuration. Selection is not available",
    });
    expect(select).toBeDisabled();
  });

  it("routes the primary action through the supplied handler", async () => {
    const user = userEvent.setup();
    const { onAction } = renderDetails(GEMINI_ROW);

    await user.click(screen.getByRole("button", { name: "Select configuration" }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "selectConfiguration" }));
  });

  it("offers a stored record this build cannot decode removal alone, behind the menu", async () => {
    const user = userEvent.setup();
    const { onAction } = renderDetails(null, {
      unrecognized: { configurationId: "cfg-retired" },
    });

    expect(buttonNames()).toEqual(["More actions"]);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    const menu = await screen.findByRole("menu", { name: "More actions" });
    for (const name of [/Update configuration/, /Verify/, /Select model/]) {
      expect(within(menu).getByRole("menuitem", { name })).toHaveAttribute("aria-disabled", "true");
    }
    await user.click(within(menu).getByRole("menuitem", { name: /Delete configuration/ }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "delete" }));
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

  it("pairs each fact term with the definition that answers it", () => {
    renderDetails(GEMINI_ROW);

    const term = screen.getByText("Product");
    // getByText matches an element's own text, so this also pins the value slot
    // to the scalar: the description is a definition of its own, not part of it.
    const value = screen.getByText(GEMINI_ROW.product.name, { selector: "dd" });
    const description = screen.getByText(GEMINI_ROW.product.description);

    // Description-list semantics, not visual adjacency: assistive tech announces
    // the facts as paired terms and definitions. (Neither role takes its name
    // from content, so the pairing is asserted, not queried by name.)
    expect(term).toHaveRole("term");
    expect(value).toHaveRole("definition");
    expect(description).toHaveRole("definition");
    // The value must follow the label it answers, never trail a description:
    // anything reading the row linearly would otherwise get a whole sentence
    // between the two. The description then follows as a second definition of
    // the same term.
    expect(term.nextElementSibling).toBe(value);
    expect(value.nextElementSibling).toBe(description);
  });

  it("publishes the display-status tone on the status readout", () => {
    renderDetails(GEMINI_ROW);

    expect(screen.getByRole("status", { name: /Ready\./i })).toHaveAttribute(
      "data-tone",
      "success",
    );
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

  it("parks focus without a ring of its own, deferring to the pane reticle", () => {
    const focusFallbackRef = createRef<HTMLDivElement>();
    renderDetails(GEMINI_ROW, { focusFallbackRef });

    // One mark per pane: the Panel reticle names the pane, so the parking
    // surface defuses its own outline. The outline tokens are libs/ui's
    // documented class contract, so a reintroduced second ring fails here
    // rather than drifting silently.
    expect(focusFallbackRef.current).toHaveClass("focus:outline-none");
    for (const token of FOCUS_OUTLINE_INSET.split(" ")) {
      expect(focusFallbackRef.current).not.toHaveClass(token);
    }
  });

  it("scrolls the details pane with the keyboard when the pane itself is focused", async () => {
    const user = userEvent.setup();
    renderDetails(GEMINI_ROW);

    const pane = screen.getByRole("region", { name: "Provider details content" });
    expect(pane).toHaveAttribute("tabindex", "0");
    // jsdom has no layout; pin the metrics that make the pane overflow.
    Object.defineProperty(pane, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(pane, "scrollHeight", { value: 1000, configurable: true });

    pane.focus();
    await user.keyboard("{ArrowDown}");
    expect(pane.scrollTop).toBe(40);

    await user.keyboard("{PageDown}");
    expect(pane.scrollTop).toBe(120);

    await user.keyboard("{ArrowUp}");
    expect(pane.scrollTop).toBe(80);
  });

  it("lets the Panel reticle alone mark the pane when it takes focus", async () => {
    const user = userEvent.setup();
    const { container } = render(<PanelHarness row={GEMINI_ROW} onAction={vi.fn()} />);

    const pane = screen.getByRole("region", { name: "Provider details content" });
    await user.tab();
    expect(pane).toHaveFocus();

    expect(screen.getByRole("region", { name: "Provider details" })).toHaveAttribute(
      "data-state",
      "focused",
    );
    // The scroller keeps keyboard scrolling but defers the pane mark to the
    // Panel: the defusal class is libs/ui's documented outline contract.
    expect(pane).toHaveClass("focus:outline-none");
    expectSingleReticle(container);
  });

  it("offers to review the provider data notice while consent is outstanding", async () => {
    const user = userEvent.setup();
    const onReviewConsent = vi.fn();
    renderDetails(GEMINI_ROW, { consentRequired: true, onReviewConsent });

    expect(screen.getByText("Consent required to run reviews")).toBeInTheDocument();
    // Neutral status, not an alert: the app stays usable without the consent.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review the provider data notice" }));
    expect(onReviewConsent).toHaveBeenCalledOnce();
  });

  it("has no axe violations with the row rested and with the More menu open", async () => {
    const user = userEvent.setup();
    const { container } = renderDetails(GEMINI_ROW, {
      activeConfigurationId: "gemini-primary",
      consentRequired: true,
      onReviewConsent: vi.fn(),
    });

    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("menu", { name: "More actions" });
    await expectNoAxeViolations(document.body);
  });
});
