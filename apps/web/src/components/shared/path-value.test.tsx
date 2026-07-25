import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PathValue } from "./path-value";

describe("PathValue", () => {
  it("splits the last segment off so only the leading segments can truncate", () => {
    render(<PathValue value="/Users/voitz/Projects/diffgazer-workspace" />);

    const path = screen.getByTitle("/Users/voitz/Projects/diffgazer-workspace");
    expect(path).toHaveTextContent("/Users/voitz/Projects/diffgazer-workspace");

    const [head, tail] = Array.from(path.children);
    expect(head).toHaveTextContent("/Users/voitz/Projects");
    expect(tail).toHaveTextContent("/diffgazer-workspace");
  });

  it("renders a path with no separator whole", () => {
    render(<PathValue value="workspace" />);

    const path = screen.getByTitle("workspace");
    expect(path).toHaveTextContent("workspace");
    expect(path.children).toHaveLength(1);
  });
});
