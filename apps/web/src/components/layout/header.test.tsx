import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./header";

describe("Header", () => {
  it("renders the diffgazer wordmark with an accessible label", () => {
    render(<Header />);
    expect(screen.getByRole("img", { name: "DIFFGAZER" })).toBeInTheDocument();
  });

  it("shows provider name and status when supplied", () => {
    render(<Header providerName="OpenAI" providerStatus="active" />);
    const status = screen.getByLabelText(/provider: openai, status: active/i);
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("OpenAI");
    expect(status).toHaveTextContent(/active/i);
  });

  it("calls onBack when the back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<Header onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("omits the back button when onBack is not provided", () => {
    render(<Header />);
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });
});
