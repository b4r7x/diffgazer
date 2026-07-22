import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ToastPositions from "./toast-positions";

describe("ToastPositions", () => {
  it("gives the Toast positions example an accessible group name", () => {
    render(<ToastPositions />);

    expect(screen.getByRole("radiogroup", { name: "Toast position" })).toBeInTheDocument();
  });
});
