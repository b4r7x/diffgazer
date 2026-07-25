import type { LensId } from "@diffgazer/core/schemas/review";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisStep } from "./analysis-step";

function Harness({ onCommit }: { onCommit: (nextValue: { defaultLenses: LensId[] }) => void }) {
  const [lenses, setLenses] = useState<LensId[]>(["correctness", "security"]);

  return <AnalysisStep lenses={lenses} onLensesChange={setLenses} onCommit={onCommit} />;
}

describe("AnalysisStep", () => {
  it("toggles the DOM-focused lens with Enter and Space", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const lensesGroup = screen.getByRole("group", { name: /active lenses/i });
    const firstLens = within(lensesGroup).getByRole("checkbox", { name: /detective/i });
    const focusedLens = within(lensesGroup).getByRole("checkbox", { name: /guardian/i });

    focusedLens.focus();
    await user.keyboard("{Enter}");

    expect(firstLens).toHaveAttribute("aria-checked", "true");
    expect(focusedLens).toHaveAttribute("aria-checked", "false");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith({ defaultLenses: ["correctness"] });

    await user.keyboard(" ");
    expect(focusedLens).toHaveAttribute("aria-checked", "true");
    expect(onCommit).toHaveBeenCalledTimes(1);

    await user.keyboard("{Enter}");
    expect(focusedLens).toHaveAttribute("aria-checked", "false");
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenLastCalledWith({ defaultLenses: ["correctness"] });
  });
});
