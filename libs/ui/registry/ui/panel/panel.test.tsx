import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "./index.js";

describe("Panel", () => {
  it("forwards refs to the selected element", () => {
    const ref = createRef<HTMLElement>();

    render(
      <Panel as="section" ref={ref} aria-label="Release">
        Notes
      </Panel>,
    );

    expect(ref.current).toBe(screen.getByRole("region", { name: "Release" }));
  });
});
