import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Kbd } from "./index";

describe("Kbd", () => {
  it("renders keyboard input semantics for individual keys and groups", () => {
    render(
      <p>
        Press <Kbd aria-label="Command key">Cmd</Kbd>{" "}
        <Kbd.Group aria-label="Save shortcut">Ctrl+S</Kbd.Group>
      </p>,
    );

    expect(screen.getByLabelText("Command key").tagName).toBe("KBD");
    expect(screen.getByLabelText("Command key")).toHaveTextContent("Cmd");
    expect(screen.getByLabelText("Save shortcut").tagName).toBe("KBD");
    expect(screen.getByLabelText("Save shortcut")).toHaveTextContent("Ctrl+S");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <p>
        Press <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>
      </p>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
