import { describe, expect, it } from "vitest";
import { ruleFor } from "./css";

describe("ruleFor", () => {
  it("matches the selector rather than a comment that names it", () => {
    const block = `
      /* .hud-tl reserves the scaled box itself. */
      .logo-figlet {
        font-size: 10px;
      }
      .hud-tl {
        width: 63ch;
      }`;

    expect(ruleFor(block, ".hud-tl")).toContain("width: 63ch");
  });

  it("does not let braces inside a comment break rule boundaries", () => {
    const block = `
      /* a stray { brace */
      .hud-br {
        display: none;
      }`;

    expect(ruleFor(block, ".hud-br")).toContain("display: none");
  });
});
