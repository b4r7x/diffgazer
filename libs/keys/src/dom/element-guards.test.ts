/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  getOwnerView,
  isEditableElement,
  isHTMLDialogElement,
  isHTMLElement,
  isHTMLInputElement,
  isHTMLTextAreaElement,
  isInputElement,
  isNode,
} from "./element-guards.js";

describe("getOwnerView", () => {
  it("returns defaultView of an attached element's ownerDocument", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(getOwnerView(el)).toBe(window);
  });

  it("returns null for primitive values", () => {
    expect(getOwnerView(null)).toBeNull();
    expect(getOwnerView(undefined)).toBeNull();
    expect(getOwnerView("string")).toBeNull();
    expect(getOwnerView(42)).toBeNull();
  });
});

describe("isHTMLElement", () => {
  it("narrows on real DOM elements", () => {
    expect(isHTMLElement(document.createElement("div"))).toBe(true);
  });

  it("rejects non-elements", () => {
    expect(isHTMLElement(null)).toBe(false);
    expect(isHTMLElement({})).toBe(false);
  });
});

describe("isHTMLDialogElement", () => {
  it("narrows on dialog elements in the element owner realm", () => {
    expect(isHTMLDialogElement(document.createElement("dialog"))).toBe(true);
    expect(isHTMLDialogElement(document.createElement("div"))).toBe(false);
  });

  it("rejects null", () => {
    expect(isHTMLDialogElement(null)).toBe(false);
  });
});

describe("isHTMLInputElement", () => {
  it("narrows on input elements only", () => {
    expect(isHTMLInputElement(document.createElement("input"))).toBe(true);
    expect(isHTMLInputElement(document.createElement("div"))).toBe(false);
  });

  it("rejects null", () => {
    expect(isHTMLInputElement(null)).toBe(false);
  });
});

describe("isHTMLTextAreaElement", () => {
  it("narrows on textarea elements only", () => {
    expect(isHTMLTextAreaElement(document.createElement("textarea"))).toBe(true);
    expect(isHTMLTextAreaElement(document.createElement("input"))).toBe(false);
  });
});

describe("isNode", () => {
  it("returns true for any DOM Node when window is provided", () => {
    expect(isNode(document.createElement("div"), window)).toBe(true);
    expect(isNode(document.createTextNode("hi"), window)).toBe(true);
  });

  it("returns false for non-Node values", () => {
    expect(isNode("string", window)).toBe(false);
    expect(isNode(null, window)).toBe(false);
  });

  it("returns false when ownerView is null", () => {
    expect(isNode(document.createElement("div"), null)).toBe(false);
  });
});

describe("isInputElement", () => {
  it.each([
    { tag: "input", expected: true },
    { tag: "textarea", expected: true },
    { tag: "select", expected: true },
  ])("classifies native <$tag> as an input element ($expected)", ({ tag, expected }) => {
    expect(isInputElement(document.createElement(tag))).toBe(expected);
  });

  it("does not classify a plain <div> as an input element", () => {
    // jsdom's isContentEditable is undefined, so the return is not strictly false.
    // In real browsers this returns false.
    expect(isInputElement(document.createElement("div"))).toBeFalsy();
  });

  it("returns false for a null target", () => {
    expect(isInputElement(null)).toBe(false);
  });
});

describe("isEditableElement", () => {
  it("returns true for input elements except non-text inputs", () => {
    const text = document.createElement("input");
    text.type = "text";
    expect(isEditableElement(text)).toBe(true);

    const search = document.createElement("input");
    search.type = "search";
    expect(isEditableElement(search)).toBe(true);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isEditableElement(checkbox)).toBe(false);

    const radio = document.createElement("input");
    radio.type = "radio";
    expect(isEditableElement(radio)).toBe(false);

    const button = document.createElement("input");
    button.type = "button";
    expect(isEditableElement(button)).toBe(false);
  });

  it("returns true for textarea", () => {
    expect(isEditableElement(document.createElement("textarea"))).toBe(true);
  });

  it("returns true for contenteditable elements", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.append(div);
    try {
      // jsdom does not implement isContentEditable; we use the attribute
      expect(isEditableElement(div)).toBe(true);
    } finally {
      div.remove();
    }
  });

  it("returns false for select (not text-editable)", () => {
    expect(isEditableElement(document.createElement("select"))).toBe(false);
  });

  it("returns false for div without contenteditable", () => {
    expect(isEditableElement(document.createElement("div"))).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isEditableElement(null)).toBe(false);
  });

  it("returns false for readonly inputs", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.readOnly = true;
    expect(isEditableElement(input)).toBe(false);
  });

  it("returns false for disabled inputs", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.disabled = true;
    expect(isEditableElement(input)).toBe(false);
  });
});
