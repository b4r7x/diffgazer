import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { SELECTABLE_PRODUCTS } from "@diffgazer/core/schemas/config";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { escapeRegExp } from "@/testing/escape-regexp";
import { ProviderStep } from "./provider-step";

describe("ProviderStep", () => {
  it("commits the current selected product when Enter is pressed", async () => {
    const selectedProduct = SELECTABLE_PRODUCTS.find(
      (product) => product.productId === "openrouter",
    );
    if (!selectedProduct) throw new Error("ProviderStep test needs the OpenRouter product");

    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <ProviderStep
        value={selectedProduct.productId as RunnableProductId}
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: new RegExp(escapeRegExp(selectedProduct.name)) }),
      ).toHaveFocus(),
    );
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith(selectedProduct.productId);
  });

  it("shows exactly 13 selectable product rows and no removed radio option", () => {
    render(
      <ProviderStep
        value={null}
        onChange={vi.fn()}
        removedRecord={{
          name: "Z.AI Coding Plan",
          description: "Removed legacy record",
          replacementName: "Z.AI",
        }}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Select product" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(13);
    expect(screen.queryByRole("radio", { name: /Z\.AI Coding Plan/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Z\.AI Coding Plan/)).toBeInTheDocument();
    expect(screen.getByText(/Create a Z\.AI configuration/i)).toBeInTheDocument();
  });

  it("uses identical shared product names and descriptions", () => {
    render(<ProviderStep value={"gemini" as RunnableProductId} onChange={vi.fn()} />);

    const gemini = SELECTABLE_PRODUCTS.find((product) => product.productId === "gemini");
    if (!gemini) throw new Error("Missing gemini product");

    expect(
      screen.getByRole("radio", { name: new RegExp(escapeRegExp(gemini.name)) }),
    ).toHaveTextContent(gemini.description);
  });
});
