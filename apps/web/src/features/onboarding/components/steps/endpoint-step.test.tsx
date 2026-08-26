import { getInitialWizardData } from "@diffgazer/core/onboarding";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { EndpointStep } from "./endpoint-step";

function ControlledEndpointStep({
  productId,
  onBoundaryReached,
}: {
  productId: RunnableProductId;
  onBoundaryReached: (direction: "up" | "down") => void;
}) {
  const [configurationInput, setConfigurationInput] = useState(
    getInitialWizardData(productId).configurationInput,
  );
  return (
    <EndpointStep
      productId={productId}
      value={configurationInput}
      onChange={setConfigurationInput}
      onBoundaryReached={onBoundaryReached}
    />
  );
}

describe("EndpointStep", () => {
  it("maps endpoint list boundaries by direction instead of always down", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(<ControlledEndpointStep productId="gemini" onBoundaryReached={onBoundaryReached} />);

    await waitFor(() => expect(screen.getByRole("radio", { name: /Global/ })).toHaveFocus());

    await user.keyboard("{ArrowUp}");
    expect(onBoundaryReached).toHaveBeenCalledWith("up");
    expect(onBoundaryReached).not.toHaveBeenCalledWith("down");

    await user.keyboard("{ArrowDown}");
    expect(onBoundaryReached).toHaveBeenCalledWith("down");
  });

  it("keeps horizontal arrows from emitting vertical endpoint boundaries", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(<ControlledEndpointStep productId="gemini" onBoundaryReached={onBoundaryReached} />);

    await waitFor(() => expect(screen.getByRole("radio", { name: /Global/ })).toHaveFocus());

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowRight}");

    expect(onBoundaryReached).not.toHaveBeenCalled();
  });

  it("moves the endpoint highlight with focus", async () => {
    render(<ControlledEndpointStep productId="gemini" onBoundaryReached={vi.fn()} />);

    const global = screen.getByRole("radio", { name: /Global/ });
    await waitFor(() => expect(global).toHaveFocus());
    expect(global).toHaveAttribute("data-highlighted");
  });

  it.each([
    "gemini",
    "zai",
  ] as const)("shows no endpoint highlight on %s while the footer owns the step", (productId) => {
    render(
      <EndpointStep
        productId={productId}
        value={getInitialWizardData(productId).configurationInput}
        onChange={vi.fn()}
        enabled={false}
      />,
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("data-highlighted");
    }
  });
});
