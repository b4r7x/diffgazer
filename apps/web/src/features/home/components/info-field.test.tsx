import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InfoField } from "./info-field";

describe("InfoField", () => {
  it("renders as a button when onClick is provided", () => {
    render(
      <InfoField label="Provider" onClick={() => {}}>
        OpenAI
      </InfoField>,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("renders as a div without button role when no onClick", () => {
    render(
      <InfoField label="Provider">
        OpenAI
      </InfoField>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Provider")).toBeInTheDocument();
  });

  it("uses fallback aria-label from label prop", () => {
    render(
      <InfoField label="Provider" onClick={() => {}}>
        OpenAI
      </InfoField>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Provider settings");
  });

  it("uses custom ariaLabel when provided", () => {
    render(
      <InfoField label="Provider" onClick={() => {}} ariaLabel="Configure provider">
        OpenAI
      </InfoField>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Configure provider");
  });

  it("calls onClick when the button is clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <InfoField label="Provider" onClick={onClick}>
        OpenAI
      </InfoField>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("activates button on Enter key", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <InfoField label="Provider" onClick={onClick}>
        OpenAI
      </InfoField>,
    );
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });
});
