import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { createTopLayerStack } from "@/lib/top-layer-stack";
import { useTopLayerPosition } from "./use-top-layer-position";

function LateElement({ stack }: { stack: ReturnType<typeof createTopLayerStack> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const isTop = useTopLayerPosition(stack, ref, true);

  return (
    <>
      <button type="button" onClick={() => setReady(true)}>
        attach
      </button>
      {ready ? <div ref={ref} /> : null}
      <output>{String(isTop)}</output>
    </>
  );
}

describe("useTopLayerPosition", () => {
  it("registers an element that attaches after active is already true", async () => {
    const user = userEvent.setup();
    render(<LateElement stack={createTopLayerStack()} />);

    expect(screen.getByRole("status")).toHaveTextContent("false");

    await user.click(screen.getByRole("button", { name: "attach" }));

    expect(screen.getByRole("status")).toHaveTextContent("true");
  });

  it("hands the top position to the element pushed last and returns it on unmount", () => {
    const stack = createTopLayerStack();

    function Layer({ active, label }: { active: boolean; label: string }) {
      const ref = useRef<HTMLDivElement>(null);
      const isTop = useTopLayerPosition(stack, ref, active);
      return (
        <div ref={ref}>
          <output aria-label={label}>{String(isTop)}</output>
        </div>
      );
    }

    const { rerender } = render(
      <>
        <Layer active label="first" />
        <Layer active={false} label="second" />
      </>,
    );

    expect(screen.getByLabelText("first")).toHaveTextContent("true");
    expect(screen.getByLabelText("second")).toHaveTextContent("false");

    rerender(
      <>
        <Layer active label="first" />
        <Layer active label="second" />
      </>,
    );

    expect(screen.getByLabelText("first")).toHaveTextContent("false");
    expect(screen.getByLabelText("second")).toHaveTextContent("true");

    rerender(
      <>
        <Layer active label="first" />
        <Layer active={false} label="second" />
      </>,
    );

    expect(screen.getByLabelText("first")).toHaveTextContent("true");
    expect(screen.getByLabelText("second")).toHaveTextContent("false");
  });
});
