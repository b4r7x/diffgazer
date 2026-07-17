import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ExecutionStep } from "./execution-step";

function Harness() {
  const [value, setValue] = useState<"sequential" | "parallel">("sequential");

  return (
    <div>
      <ExecutionStep value={value} onChange={setValue} />
      <button type="button">After execution modes</button>
    </div>
  );
}

describe("ExecutionStep", () => {
  it("returns keyboard focus to the execution mode selected by pointer", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const parallel = screen.getByRole("radio", { name: /parallel/i });
    await user.click(parallel);
    expect(parallel).toHaveAttribute("aria-checked", "true");

    await user.tab();
    expect(screen.getByRole("button", { name: "After execution modes" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(parallel).toHaveFocus();
  });
});
