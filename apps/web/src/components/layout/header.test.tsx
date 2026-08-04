import type { ProviderDisplayStatus } from "@diffgazer/core/providers";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./header";

const readyStatus: ProviderDisplayStatus = {
  status: "ready",
  action: "inspect",
  label: "Ready",
  shortLabel: "ready",
  variant: "success",
  explanation: "",
  remediation: "",
  accessibleText: "Ready",
};

const idleStatus: ProviderDisplayStatus = {
  status: "unconfigured",
  action: "create",
  label: "Not configured",
  shortLabel: "setup",
  variant: "warning",
  explanation: "",
  remediation: "",
  accessibleText: "Not configured",
};

const pendingStatus: ProviderDisplayStatus = {
  status: "conformance-pending",
  action: "inspect",
  label: "Checking compatibility",
  shortLabel: "pending",
  variant: "info",
  explanation: "",
  remediation: "",
  accessibleText: "Checking compatibility",
};

describe("Header", () => {
  it("renders the ascii wordmark, never a plain-text one, at both tiers", () => {
    const { rerender } = render(
      <Header providerName="OpenAI" providerStatus={idleStatus} wordmark="hero" />,
    );

    expect(screen.getAllByRole("img", { name: "diffgazer" })).toHaveLength(1);
    expect(screen.queryByText("DIFFGAZER")).not.toBeInTheDocument();

    rerender(<Header providerName="OpenAI" providerStatus={idleStatus} wordmark="dense" />);

    expect(screen.getAllByRole("img", { name: "diffgazer" })).toHaveLength(1);
    expect(screen.queryByText("DIFFGAZER")).not.toBeInTheDocument();
  });

  it("renders the ornament outside the wordmark art", () => {
    render(<Header providerName="OpenAI" providerStatus={idleStatus} wordmark="hero" />);

    const wordmark = screen.getByRole("img", { name: "diffgazer" });
    const ornament = screen.getByText("─ ✦ ─ ✧ ─");

    // Where the ornament lands relative to the art is a rendered-layout fact and
    // belongs to the desktop e2e contract; jsdom can only see that the art does
    // not carry it.
    expect(wordmark).not.toContainElement(ornament);
  });

  it("reads provider, model and a one-word status in the corner chip", () => {
    render(
      <Header
        providerName="Google Gemini / gemini-3-flash-preview"
        providerStatus={pendingStatus}
      />,
    );

    // The aria-label replaces the row's children for assistive tech, so it spells
    // the status out where the chip shows the short word.
    const status = screen.getByLabelText(
      "Provider: Google Gemini / gemini-3-flash-preview, Checking compatibility; server live",
    );
    expect(status).toHaveTextContent(/^Google Gemini \/ gemini-3-flash-preview\s*·\s*pending$/);
  });

  it("keeps the connection status visible when the model name truncates", () => {
    const longModel = "OpenAI / a-very-long-provider-model-name-that-overflows-the-mobile-row";
    render(<Header providerName={longModel} providerStatus={readyStatus} onBack={() => {}} />);

    const status = screen.getByText("ready");
    const modelSegment = screen.getByText(longModel);

    expect(status).toBeInTheDocument();
    expect(modelSegment).not.toContainElement(status);
  });

  it("calls onBack when the back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<Header providerName="OpenAI" providerStatus={idleStatus} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("omits the back button when onBack is not provided", () => {
    render(<Header providerName="OpenAI" providerStatus={idleStatus} />);
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });

  it("tells the truth about the transport instead of the provider alone", () => {
    const { rerender } = render(
      <Header
        providerName="gemini"
        providerStatus={readyStatus}
        wordmark="dense"
        serverState="offline"
      />,
    );

    expect(screen.getByLabelText("Provider: gemini, Ready; server offline")).toHaveTextContent(
      "Offline",
    );

    rerender(
      <Header
        providerName="gemini"
        providerStatus={readyStatus}
        wordmark="dense"
        serverState="retrying"
      />,
    );

    expect(screen.getByLabelText("Provider: gemini, Ready; server reconnecting")).toHaveTextContent(
      "Reconnecting",
    );

    rerender(<Header providerName="gemini" providerStatus={readyStatus} wordmark="dense" />);

    expect(screen.getByLabelText("Provider: gemini, Ready; server live")).toHaveTextContent(
      "ready",
    );
  });
});
