import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button StrictMode", () => {
  it("renders in React StrictMode", () => {
    render(
      <StrictMode>
        <Button>Save</Button>
      </StrictMode>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
