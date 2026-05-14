/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { getOwnerView, isHTMLElement, isHTMLInputElement, isHTMLTextAreaElement, isNode } from "./dom.js";

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
