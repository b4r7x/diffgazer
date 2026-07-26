import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./header";

describe("Header", () => {
  it("renders the diffgazer wordmark with an accessible label", () => {
    render(<Header providerName="OpenAI" providerStatus="idle" />);
    expect(screen.getByRole("img", { name: "diffgazer" })).toBeInTheDocument();
  });

  it("renders a single ascii wordmark with no plain-text fallback", () => {
    render(<Header providerName="OpenAI" providerStatus="idle" />);

    expect(screen.getAllByRole("img", { name: "diffgazer" })).toHaveLength(1);
    expect(screen.queryByText("DIFFGAZER")).not.toBeInTheDocument();
  });

  it("swaps the figlet banner for a one-line wordmark on work screens", () => {
    render(<Header providerName="OpenAI" providerStatus="idle" wordmark="line" />);

    expect(screen.queryByRole("img", { name: "diffgazer" })).not.toBeInTheDocument();
    expect(screen.getByText("DIFFGAZER")).toBeInTheDocument();
  });

  it("shows provider name and status when supplied", () => {
    render(
      <Header
        providerName="OpenAI / a-provider-model-name-that-needs-to-fit"
        providerStatus="active"
      />,
    );
    // The aria-label replaces the row's children for assistive tech, so it has
    // to carry the status word the sighted user reads beside the name.
    const status = screen.getByLabelText(
      "Provider: OpenAI / a-provider-model-name-that-needs-to-fit, active; server live",
    );
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("OpenAI / a-provider-model-name-that-needs-to-fit");
    expect(status).toHaveTextContent(/active/i);
  });

  it("keeps the connection status visible when the model name truncates", () => {
    const longModel = "OpenAI / a-very-long-provider-model-name-that-overflows-the-mobile-row";
    render(<Header providerName={longModel} providerStatus="active" onBack={() => {}} />);

    const status = screen.getByText("active");
    const modelSegment = screen.getByText(longModel);

    expect(status).toBeInTheDocument();
    expect(modelSegment).not.toContainElement(status);
  });

  it("calls onBack when the back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<Header providerName="OpenAI" providerStatus="idle" onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("omits the back button when onBack is not provided", () => {
    render(<Header providerName="OpenAI" providerStatus="idle" />);
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });

  it("tells the truth about the transport instead of the provider alone", () => {
    const { rerender } = render(
      <Header
        providerName="gemini"
        providerStatus="active"
        wordmark="line"
        serverState="offline"
      />,
    );

    expect(screen.getByLabelText("Provider: gemini, active; server offline")).toHaveTextContent(
      "Offline",
    );

    rerender(
      <Header
        providerName="gemini"
        providerStatus="active"
        wordmark="line"
        serverState="retrying"
      />,
    );

    expect(
      screen.getByLabelText("Provider: gemini, active; server reconnecting"),
    ).toHaveTextContent("Reconnecting");

    rerender(<Header providerName="gemini" providerStatus="active" wordmark="line" />);

    expect(screen.getByLabelText("Provider: gemini, active; server live")).toHaveTextContent(
      "active",
    );
  });
});
