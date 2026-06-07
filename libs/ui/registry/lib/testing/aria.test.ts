/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { isHTMLElementForContainer, mergeIds, resolveAriaInvalid } from "../aria";

describe("resolveAriaInvalid", () => {
  it.each([
    { ariaInvalid: undefined, forceInvalid: true, expected: true },
    { ariaInvalid: false, forceInvalid: true, expected: true },
    { ariaInvalid: "false" as const, forceInvalid: true, expected: true },
  ])("forceInvalid=$forceInvalid overrides ariaInvalid=$ariaInvalid → $expected", ({
    ariaInvalid,
    forceInvalid,
    expected,
  }) => {
    expect(resolveAriaInvalid(ariaInvalid, forceInvalid)).toBe(expected);
  });

  it.each([
    { ariaInvalid: "grammar" as const, expected: "grammar" },
    { ariaInvalid: "spelling" as const, expected: "spelling" },
    { ariaInvalid: "true" as const, expected: "true" },
    { ariaInvalid: true, expected: true },
  ])("passes through truthy aria-invalid variant $ariaInvalid", ({ ariaInvalid, expected }) => {
    expect(resolveAriaInvalid(ariaInvalid)).toBe(expected);
  });

  it.each([
    { ariaInvalid: false, expected: false },
    { ariaInvalid: "false" as const, expected: "false" },
  ])("passes through explicit false-y aria-invalid variant $ariaInvalid", ({
    ariaInvalid,
    expected,
  }) => {
    expect(resolveAriaInvalid(ariaInvalid)).toBe(expected);
  });

  it.each([
    { ariaInvalid: undefined, forceInvalid: undefined },
    { ariaInvalid: undefined, forceInvalid: false },
  ])("returns undefined when ariaInvalid=undefined and forceInvalid=$forceInvalid", ({
    ariaInvalid,
    forceInvalid,
  }) => {
    expect(resolveAriaInvalid(ariaInvalid, forceInvalid)).toBeUndefined();
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
