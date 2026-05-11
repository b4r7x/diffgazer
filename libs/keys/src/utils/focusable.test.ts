import { afterEach, describe, expect, it } from "vitest";
import { getFirstFocusableElement, getFocusableElements, getTabbableElements, isFocusable } from "./focusable.js";

function mount(html: string): HTMLDivElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

describe("focusable utilities", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  describe("getFocusableElements", () => {
    it("returns null-safe empty array", () => {
      expect(getFocusableElements(null)).toEqual([]);
    });

    it("returns visible buttons, links, inputs, and programmatically focusable elements", () => {
      const c = mount(`
        <button id="a">A</button>
        <a id="b" href="#">B</a>
        <input id="c" />
        <textarea id="d"></textarea>
        <select id="e"><option>x</option></select>
        <div id="f" tabindex="0">F</div>
        <div id="g" tabindex="-1">G</div>
        <details><summary id="s">Summary</summary><p>Details</p></details>
        <div id="h">No tabindex</div>
      `);
      const ids = getFocusableElements(c).map((el) => el.id);
      expect(ids).toEqual(["a", "b", "c", "d", "e", "f", "g", "s"]);
    });

    it("skips disabled native elements", () => {
      const c = mount(`
        <button id="a">A</button>
        <button id="b" disabled>B</button>
        <input id="c" disabled />
      `);
      const ids = getFocusableElements(c).map((el) => el.id);
      expect(ids).toEqual(["a"]);
    });

    it("skips elements inside a disabled fieldset", () => {
      const c = mount(`
        <fieldset disabled>
          <button id="a">A</button>
          <input id="b" />
        </fieldset>
        <button id="c">C</button>
      `);
      const ids = getFocusableElements(c).map((el) => el.id);
      expect(ids).toEqual(["c"]);
    });

    it("skips elements with display:none on self or ancestor", () => {
      const c = mount(`
        <button id="a" style="display:none">A</button>
        <div style="display:none"><button id="b">B</button></div>
        <button id="c">C</button>
      `);
      const ids = getFocusableElements(c).map((el) => el.id);
      expect(ids).toEqual(["c"]);
    });

    it("skips elements with visibility:hidden on self or ancestor", () => {
      const c = mount(`
        <button id="a" style="visibility:hidden">A</button>
        <div style="visibility:hidden"><button id="b">B</button></div>
        <button id="c">C</button>
      `);
      const ids = getFocusableElements(c).map((el) => el.id);
      expect(ids).toEqual(["c"]);
    });

    it("skips elements with inert on self or ancestor", () => {
      const c = mount(`
        <button id="a" inert>A</button>
        <div inert><button id="b">B</button></div>
        <button id="c">C</button>
      `);
      const ids = getFocusableElements(c).map((el) => el.id);
      expect(ids).toEqual(["c"]);
    });

    it("skips elements with aria-hidden on self or ancestor", () => {
      const c = mount(`
        <button id="a" aria-hidden="true">A</button>
        <div aria-hidden="true"><button id="b">B</button></div>
        <button id="c">C</button>
      `);
      const ids = getFocusableElements(c).map((el) => el.id);
      expect(ids).toEqual(["c"]);
    });

    it("includes contenteditable elements", () => {
      const c = mount(`
        <div id="a" contenteditable="true">CE</div>
        <div id="b" contenteditable="false">Not editable</div>
        <button id="c">C</button>
      `);
      const ids = getFocusableElements(c).map((el) => el.id);
      expect(ids).toEqual(["a", "c"]);
    });
  });

  describe("getFirstFocusableElement", () => {
    it("returns the first focusable in DOM order", () => {
      const c = mount(`
        <button id="a">A</button>
        <button id="b">B</button>
      `);
      expect(getFirstFocusableElement(c)?.id).toBe("a");
    });

    it("returns null when nothing is focusable", () => {
      const c = mount("<div>Nothing</div>");
      expect(getFirstFocusableElement(c)).toBeNull();
    });
  });

  describe("getTabbableElements", () => {
    it("returns elements in browser Tab order", () => {
      const c = mount(`
        <button id="a">A</button>
        <button id="b" tabindex="3">B</button>
        <button id="c" tabindex="1">C</button>
        <button id="d" tabindex="-1">D</button>
        <a id="e" href="#">E</a>
      `);

      const ids = getTabbableElements(c).map((el) => el.id);
      expect(ids).toEqual(["c", "b", "a", "e"]);
    });

    it("excludes negative tabindex values from Tab order", () => {
      const c = mount(`
        <button id="a" tabindex="-1">A</button>
        <div id="b" tabindex="-2">B</div>
        <button id="c">C</button>
      `);

      expect(getTabbableElements(c).map((el) => el.id)).toEqual(["c"]);
    });

    it("includes summary elements in Tab order", () => {
      const c = mount(`
        <details>
          <summary id="a">Details</summary>
          <button id="b">B</button>
        </details>
      `);

      expect(getTabbableElements(c).map((el) => el.id)).toEqual(["a", "b"]);
    });

    it("keeps one Tab stop per named native radio group", () => {
      const c = mount(`
        <input id="a" type="radio" name="choice" />
        <input id="b" type="radio" name="choice" checked />
        <input id="c" type="radio" name="choice" />
        <input id="d" type="radio" name="other" />
        <input id="e" type="radio" name="other" />
        <input id="f" type="radio" />
      `);

      expect(getTabbableElements(c).map((el) => el.id)).toEqual(["b", "d", "f"]);
    });

    it("keeps same-name radios in different forms as separate Tab stops", () => {
      const c = mount(`
        <form><input id="a" type="radio" name="choice" /></form>
        <form><input id="b" type="radio" name="choice" /></form>
      `);

      expect(getTabbableElements(c).map((el) => el.id)).toEqual(["a", "b"]);
    });
  });

  describe("isFocusable", () => {
    it("returns true for visible buttons", () => {
      const c = mount('<button id="a">A</button>');
      expect(isFocusable(c.querySelector<HTMLElement>("#a")!)).toBe(true);
    });

    it("returns true for negative-tabindex programmatic focus targets", () => {
      const c = mount('<div id="a" tabindex="-1">A</div>');
      expect(isFocusable(c.querySelector<HTMLElement>("#a")!)).toBe(true);
    });

    it("returns true for summary elements", () => {
      const c = mount('<details><summary id="a">Details</summary></details>');
      expect(isFocusable(c.querySelector<HTMLElement>("#a")!)).toBe(true);
    });

    it("returns false for disabled buttons", () => {
      const c = mount('<button id="a" disabled>A</button>');
      expect(isFocusable(c.querySelector<HTMLElement>("#a")!)).toBe(false);
    });

    it("returns false for elements inside an inert ancestor", () => {
      const c = mount('<div inert><button id="a">A</button></div>');
      expect(isFocusable(c.querySelector<HTMLElement>("#a")!)).toBe(false);
    });

    it("works with elements from another document realm", () => {
      const frame = document.createElement("iframe");
      document.body.append(frame);
      const frameDocument = frame.contentDocument;
      expect(frameDocument).not.toBeNull();
      frameDocument!.body.innerHTML = '<div id="root"><button id="a">A</button></div>';

      const button = frameDocument!.getElementById("a") as HTMLElement;
      const root = frameDocument!.getElementById("root") as HTMLElement;

      expect(isFocusable(button)).toBe(true);
      expect(getFocusableElements(root)).toEqual([button]);
    });
  });
});
