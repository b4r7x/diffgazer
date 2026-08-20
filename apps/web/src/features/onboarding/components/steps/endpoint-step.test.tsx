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
  it("routes the down boundary into the required workspace input and back", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(<ControlledEndpointStep productId="qwen" onBoundaryReached={onBoundaryReached} />);

    const endpointRadio = screen.getByRole("radio", { name: /International/ });
    await waitFor(() => expect(endpointRadio).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    const workspace = screen.getByLabelText("Workspace reference");
    expect(workspace).toHaveFocus();
    expect(onBoundaryReached).not.toHaveBeenCalled();

    // The j/k list aliases are printable characters that must type into the field.
    await user.keyboard("jk-workspace");
    expect(workspace).toHaveValue("jk-workspace");
    expect(workspace).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(endpointRadio).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(workspace).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(onBoundaryReached).toHaveBeenCalledWith("down");
  });

  it("maps endpoint list boundaries by direction instead of always down", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(<ControlledEndpointStep productId="moonshot" onBoundaryReached={onBoundaryReached} />);

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Mainland China/ })).toHaveFocus(),
    );

    await user.keyboard("{ArrowUp}");
    expect(onBoundaryReached).toHaveBeenCalledWith("up");
    expect(onBoundaryReached).not.toHaveBeenCalledWith("down");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /International/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(onBoundaryReached).toHaveBeenCalledWith("down");
  });

  it("keeps horizontal arrows from emitting vertical endpoint boundaries", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(<ControlledEndpointStep productId="moonshot" onBoundaryReached={onBoundaryReached} />);

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Mainland China/ })).toHaveFocus(),
    );

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /International/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}");

    expect(onBoundaryReached).not.toHaveBeenCalled();
  });

  it("moves the highlight with focus between the endpoint list and the workspace input", async () => {
    const user = userEvent.setup();

    render(<ControlledEndpointStep productId="qwen" onBoundaryReached={vi.fn()} />);

    const endpointRadio = screen.getByRole("radio", { name: /International/ });
    await waitFor(() => expect(endpointRadio).toHaveFocus());
    expect(endpointRadio).toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByLabelText("Workspace reference")).toHaveFocus();
    expect(endpointRadio).not.toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowUp}");
    expect(endpointRadio).toHaveFocus();
    expect(endpointRadio).toHaveAttribute("data-highlighted");
  });

  it("restores the endpoint highlight when Shift+Tab lands back on the selected radio", async () => {
    const user = userEvent.setup();

    render(<ControlledEndpointStep productId="qwen" onBoundaryReached={vi.fn()} />);

    const endpointRadio = screen.getByRole("radio", { name: /International/ });
    await waitFor(() => expect(endpointRadio).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByLabelText("Workspace reference")).toHaveFocus();
    expect(endpointRadio).not.toHaveAttribute("data-highlighted");

    await user.tab({ shift: true });
    expect(endpointRadio).toHaveFocus();
    expect(endpointRadio).toHaveAttribute("data-highlighted");
  });

  it.each([
    "qwen",
    "local-openai",
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

  it("reports the up boundary from the first loopback endpoint", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(
      <ControlledEndpointStep productId="local-openai" onBoundaryReached={onBoundaryReached} />,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: /LM Studio/ })).toHaveFocus());
    await user.keyboard("{ArrowUp}");

    expect(onBoundaryReached).toHaveBeenCalledWith("up");
    expect(onBoundaryReached).not.toHaveBeenCalledWith("down");
  });
});
