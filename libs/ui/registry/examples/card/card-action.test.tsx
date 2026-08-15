import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CardActionExample from "./card-action";

describe("CardActionExample", () => {
  it("gives the icon-only action an accessible name", () => {
    render(<CardActionExample />);

    expect(screen.getByRole("button", { name: "More actions" })).toHaveTextContent("···");
  });
});
