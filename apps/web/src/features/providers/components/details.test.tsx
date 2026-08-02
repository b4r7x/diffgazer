import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildProviderRows } from "../testing/fixtures";
import { ProviderDetails } from "./details";

const ROWS = buildProviderRows();
const GEMINI_ROW = ROWS.find((row) => row.configuration?.configurationId === "gemini-primary");
if (!GEMINI_ROW) throw new Error("Missing gemini fixture");

const NOOP_ACTIONS = {
  onSetup: vi.fn(),
  onSelectModel: vi.fn(),
  onDelete: vi.fn(),
  onDispatchAction: vi.fn(),
};

describe("ProviderDetails", () => {
  it("routes the primary action through the supplied dispatch callback", async () => {
    const user = userEvent.setup();
    const onDispatchAction = vi.fn();
    render(<ProviderDetails row={GEMINI_ROW} actions={{ ...NOOP_ACTIONS, onDispatchAction }} />);

    await user.click(screen.getByRole("button", { name: /Select configuration/i }));

    expect(onDispatchAction).toHaveBeenCalledOnce();
  });

  it("shows exact selected model and readiness without API-key status", () => {
    render(<ProviderDetails row={GEMINI_ROW} actions={NOOP_ACTIONS} />);

    expect(screen.getByRole("status", { name: /Ready\./i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ready\./i)).toBeInTheDocument();
    expect(screen.queryByText(/API Key Status/i)).not.toBeInTheDocument();
  });

  it("shows CLI unsupported evidence for unsupported CLI rows", () => {
    const cliRow = ROWS.find((row) => row.configuration?.configurationId === "codex-cli-1");
    if (!cliRow) throw new Error("Missing CLI fixture");

    render(<ProviderDetails row={cliRow} actions={NOOP_ACTIONS} />);
    expect(screen.getByLabelText(/CLI unsupported\./i)).toBeInTheDocument();
  });

  it("shows removed migration guidance without selectable actions", () => {
    const removedRow = ROWS.find(
      (row) => row.configuration?.configurationId === "legacy-removed-zai-plan",
    );
    if (!removedRow) throw new Error("Missing removed fixture");

    render(<ProviderDetails row={removedRow} actions={NOOP_ACTIONS} />);
    expect(screen.getByText(/Migration/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Removed records cannot be selected/i }),
    ).toBeDisabled();
  });

  it("prompts to select a provider when none is provided", () => {
    render(<ProviderDetails row={null} actions={NOOP_ACTIONS} />);
    expect(screen.getByText(/select a provider to view details/i)).toBeInTheDocument();
  });

  it("disables every provider action while a mutation is pending", () => {
    render(<ProviderDetails row={GEMINI_ROW} actions={NOOP_ACTIONS} isPending />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
