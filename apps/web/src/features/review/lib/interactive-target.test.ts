import { afterEach, describe, expect, it } from "vitest";
import { isInteractiveTarget } from "./interactive-target";

describe("isInteractiveTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns false for non-element targets", () => {
    expect(isInteractiveTarget(null)).toBe(false);
    expect(isInteractiveTarget(document.createTextNode("x") as unknown as EventTarget)).toBe(false);
  });

  it("matches native actionable elements", () => {
    for (const html of [
      "<a href='#'>a</a>",
      "<button>b</button>",
      "<input />",
      "<textarea></textarea>",
      "<select></select>",
    ]) {
      document.body.innerHTML = html;
      expect(isInteractiveTarget(document.body.firstElementChild)).toBe(true);
    }
  });

  it("matches ARIA widget roles and contenteditable", () => {
    for (const html of [
      "<div role='button'>b</div>",
      "<div role='checkbox'>c</div>",
      "<div role='radio'>r</div>",
      "<div role='tab'>t</div>",
      "<div contenteditable='true'>e</div>",
    ]) {
      document.body.innerHTML = html;
      expect(isInteractiveTarget(document.body.firstElementChild)).toBe(true);
    }
  });

  it("matches a child inside an interactive ancestor", () => {
    document.body.innerHTML = "<button><span>label</span></button>";
    const span = document.querySelector("span");
    expect(isInteractiveTarget(span)).toBe(true);
  });

  it("matches an SVG icon inside a button", () => {
    document.body.innerHTML = "<button><svg><path d='M0 0' /></svg></button>";
    expect(isInteractiveTarget(document.querySelector("svg"))).toBe(true);
    expect(isInteractiveTarget(document.querySelector("path"))).toBe(true);
  });

  it("does not match plain or focusable scroll containers", () => {
    document.body.innerHTML = "<div tabindex='0'><p>text</p></div>";
    expect(isInteractiveTarget(document.body.firstElementChild)).toBe(false);
    expect(isInteractiveTarget(document.querySelector("p"))).toBe(false);
  });
});
