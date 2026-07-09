/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  getComposedEventTarget,
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

  it("returns a strict boolean false for a plain <div>", () => {
    expect(isInputElement(document.createElement("div"))).toBe(false);
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
      // jsdom does not implement isContentEditable; fall back to the attribute.
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

describe("getComposedEventTarget", () => {
  it("returns the deepest shadow target instead of the retargeted host", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    shadowRoot.appendChild(input);

    let captured: EventTarget | null = null;
    const onKeyDown = (event: Event) => {
      captured = getComposedEventTarget(event);
    };
    document.addEventListener("keydown", onKeyDown);
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true }));
    document.removeEventListener("keydown", onKeyDown);

    expect(captured).toBe(input);
    host.remove();
  });

  it("falls back to event.target when composedPath is empty", () => {
    const event = new KeyboardEvent("keydown");
    expect(getComposedEventTarget(event)).toBe(event.target);
  });
});
