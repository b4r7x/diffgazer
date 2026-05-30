import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { App } from "./App";

describe("Landing App", () => {
  it("renders heading and install command", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /diffgazer/i })).toBeInTheDocument();
    expect(screen.getByText(/npm install/i)).toBeInTheDocument();
  });

  it("has documentation link pointing at the default docs origin", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /documentation/i })).toHaveAttribute(
      "href",
      "https://docs.b4r7.dev",
    );
  });

  it("exposes header, main, and footer landmarks", () => {
    render(<App />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("targets the main landmark from the skip link", () => {
    render(<App />);
    const skipLink = screen.getByRole("link", { name: /skip to content/i });
    expect(skipLink).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("moves keyboard focus to the skip link first", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.tab();
    expect(screen.getByRole("link", { name: /skip to content/i })).toHaveFocus();
  });

  it("labels the install command for assistive tech", () => {
    render(<App />);
    expect(screen.getByLabelText("Install command")).toHaveTextContent(
      "npm install -g diffgazer",
    );
  });

  it("copies the install command and reflects the copied state", async () => {
    const user = userEvent.setup();
    render(<App />);
    const copyButton = screen.getByRole("button", { name: /copy install command/i });

    await user.click(copyButton);

    expect(await navigator.clipboard.readText()).toBe("npm install -g diffgazer");
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
