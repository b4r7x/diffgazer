/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { isHTMLElementForContainer, mergeIds, resolveAriaInvalid } from "../aria-utils.js";

describe("resolveAriaInvalid", () => {
  it("returns true when forceInvalid is true regardless of ariaInvalid", () => {
    expect(resolveAriaInvalid(undefined, true)).toBe(true);
    expect(resolveAriaInvalid(false, true)).toBe(true);
    expect(resolveAriaInvalid("false", true)).toBe(true);
  });

  it("passes through truthy aria-invalid string variants", () => {
    expect(resolveAriaInvalid("grammar")).toBe("grammar");
    expect(resolveAriaInvalid("spelling")).toBe("spelling");
    expect(resolveAriaInvalid("true")).toBe("true");
    expect(resolveAriaInvalid(true)).toBe(true);
  });

  it("passes through explicit false-y aria-invalid variants", () => {
    expect(resolveAriaInvalid(false)).toBe(false);
    expect(resolveAriaInvalid("false")).toBe("false");
  });

  it("returns undefined when no signal is present", () => {
    expect(resolveAriaInvalid(undefined)).toBeUndefined();
    expect(resolveAriaInvalid(undefined, false)).toBeUndefined();
  });
});

describe("mergeIds", () => {
  it("joins multiple id strings with single space", () => {
    expect(mergeIds("a", "b", "c")).toBe("a b c");
  });

  it("splits and re-joins whitespace-separated ids", () => {
    expect(mergeIds("a b", "c")).toBe("a b c");
  });

  it("skips undefined and empty entries", () => {
    expect(mergeIds("a", undefined, "b")).toBe("a b");
    expect(mergeIds(undefined, undefined)).toBeUndefined();
    expect(mergeIds("")).toBeUndefined();
  });

  it("returns undefined when nothing to merge", () => {
    expect(mergeIds()).toBeUndefined();
  });
});

describe("isHTMLElementForContainer", () => {
  it("returns true when value is an HTMLElement in container ownerDocument", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const child = document.createElement("span");
    expect(isHTMLElementForContainer(child, container)).toBe(true);
  });

  it("returns false when container is null", () => {
    const child = document.createElement("span");
    expect(isHTMLElementForContainer(child, null)).toBe(false);
  });

  it("returns false for non-HTMLElement values", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    expect(isHTMLElementForContainer(null, container)).toBe(false);
    expect(isHTMLElementForContainer("string", container)).toBe(false);
    expect(isHTMLElementForContainer({}, container)).toBe(false);
  });
});
