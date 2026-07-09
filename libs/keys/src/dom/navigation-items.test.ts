import { afterEach, describe, expect, it } from "vitest";
import { containsActiveElement } from "./focusable.js";
import {
  findNavigationItemByValue,
  focusNavigationItem,
  getFocusedNavigationValue,
  getNavigationItemProps,
  getNavigationItems,
  NAVIGATION_ITEM_ATTRIBUTE,
  type NavigationItemType,
} from "./navigation-items.js";

function mountContainer(role?: string) {
  const container = document.createElement("div");
  if (role) container.setAttribute("role", role);
  document.body.append(container);
  return container;
}

function appendElement(
  container: HTMLElement,
  {
    tag = "div",
    role,
    type,
    value,
    text = value,
    tabIndex,
    attributes = {},
  }: {
    tag?: string;
    role?: string;
    type?: string;
    value?: string;
    text?: string;
    tabIndex?: number;
    attributes?: Record<string, string>;
  },
) {
  const element = document.createElement(tag);
  if (role) element.setAttribute("role", role);
  if (type) element.setAttribute("type", type);
  if (value !== undefined) element.dataset.value = value;
  if (text !== undefined) element.textContent = text;
  if (tabIndex !== undefined) element.tabIndex = tabIndex;
  for (const [name, attributeValue] of Object.entries(attributes)) {
    element.setAttribute(name, attributeValue);
  }
  container.append(element);
  return element;
}

function values(elements: HTMLElement[]) {
  return elements.map((element) => element.dataset.value);
}

function withGlobalNodeUnavailable(run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Node");
  Object.defineProperty(globalThis, "Node", { configurable: true, value: undefined });
  try {
    run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "Node", descriptor);
    } else {
      delete (globalThis as { Node?: typeof Node }).Node;
    }
  }
}

describe("navigation item utilities", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("merges data-contract and role items in DOM order", () => {
    const container = mountContainer("listbox");
    appendElement(container, {
      value: "contract",
      attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "option" },
    });
    appendElement(container, { role: "option", value: "role" });
    appendElement(container, { attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "option" } });

    expect(values(getNavigationItems(container, { type: "option" }))).toEqual(["contract", "role"]);
  });

  it("sorts merged selector groups in document order without the global Node constructor", () => {
    const container = mountContainer("listbox");
    appendElement(container, {
      value: "contract",
      attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "option" },
    });
    appendElement(container, { role: "option", value: "role" });

    withGlobalNodeUnavailable(() => {
      expect(values(getNavigationItems(container, { type: "option" }))).toEqual([
        "contract",
        "role",
      ]);
    });
  });

  it("queries native buttons, radios, and checkboxes with data values", () => {
    const actions = mountContainer("group");
    appendElement(actions, { tag: "button", value: "save", text: "Save" });
    appendElement(actions, { tag: "button", value: "cancel", text: "Cancel" });

    const radios = mountContainer("radiogroup");
    appendElement(radios, { tag: "input", type: "radio", value: "small" });
    appendElement(radios, { tag: "input", type: "radio", value: "large" });

    const checkboxes = mountContainer("group");
    appendElement(checkboxes, { tag: "input", type: "checkbox", value: "bold" });
    appendElement(checkboxes, { tag: "input", type: "checkbox", value: "italic" });

    expect(values(getNavigationItems(actions, { type: "button" }))).toEqual(["save", "cancel"]);
    expect(values(getNavigationItems(radios, { type: "radio" }))).toEqual(["small", "large"]);
    expect(values(getNavigationItems(checkboxes, { type: "checkbox" }))).toEqual([
      "bold",
      "italic",
    ]);
  });

  it("does not let typed data-contract items satisfy another navigation type", () => {
    const container = mountContainer("group");
    appendElement(container, {
      value: "typed-option",
      attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "option" },
    });
    appendElement(container, {
      value: "typed-radio",
      attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "radio" },
    });
    appendElement(container, { tag: "button", value: "button", text: "Button" });

    expect(values(getNavigationItems(container, { type: "button" }))).toEqual(["button"]);
  });

  it("queries role items with data values", () => {
    const container = mountContainer("menu");
    appendElement(container, { role: "menuitem", value: "open" });
    appendElement(container, { role: "menuitem", value: "close" });

    expect(values(getNavigationItems(container, { type: "menuitem" }))).toEqual(["open", "close"]);
  });

  it("queries menuitemcheckbox items with data values", () => {
    const container = mountContainer("menu");
    appendElement(container, { role: "menuitemcheckbox", value: "bold" });
    appendElement(container, { role: "menuitemcheckbox", value: "italic" });

    expect(values(getNavigationItems(container, { type: "menuitemcheckbox" }))).toEqual([
      "bold",
      "italic",
    ]);
  });

  it("excludes disabled items by aria, data, and native disabled states", () => {
    const options = mountContainer("listbox");
    appendElement(options, { role: "option", value: "a" });
    appendElement(options, {
      role: "option",
      value: "aria",
      attributes: { "aria-disabled": "true" },
    });
    appendElement(options, {
      role: "option",
      value: "data",
      attributes: { "data-disabled": "" },
    });
    appendElement(options, { role: "option", value: "b" });

    const buttons = mountContainer("group");
    appendElement(buttons, { tag: "button", value: "enabled", text: "Enabled" });
    appendElement(buttons, {
      tag: "button",
      value: "disabled",
      text: "Disabled",
      attributes: { disabled: "" },
    });

    expect(values(getNavigationItems(options, { type: "option" }))).toEqual(["a", "b"]);
    expect(values(getNavigationItems(buttons, { type: "button" }))).toEqual(["enabled"]);
    expect(values(getNavigationItems(options, { type: "option", skipDisabled: false }))).toEqual([
      "a",
      "aria",
      "data",
      "b",
    ]);
  });

  it("excludes hidden, inert, and aria-hidden items between visible siblings", () => {
    const options = mountContainer("listbox");
    appendElement(options, { role: "option", value: "a" });
    appendElement(options, { role: "option", value: "hidden", attributes: { hidden: "" } });
    appendElement(options, { role: "option", value: "inert", attributes: { inert: "" } });
    appendElement(options, {
      role: "option",
      value: "aria-hidden",
      attributes: { "aria-hidden": "true" },
    });
    appendElement(options, { role: "option", value: "b" });

    expect(values(getNavigationItems(options, { type: "option" }))).toEqual(["a", "b"]);
    expect(values(getNavigationItems(options, { type: "option", skipDisabled: false }))).toEqual([
      "a",
      "b",
    ]);
  });

  it("excludes items under hidden, inert, and aria-hidden ancestors", () => {
    const options = mountContainer("listbox");
    appendElement(options, { role: "option", value: "a" });
    const hiddenGroup = appendElement(options, { attributes: { hidden: "" } });
    appendElement(hiddenGroup, { role: "option", value: "under-hidden" });
    const inertGroup = appendElement(options, { attributes: { inert: "" } });
    appendElement(inertGroup, { role: "option", value: "under-inert" });
    const ariaHiddenGroup = appendElement(options, { attributes: { "aria-hidden": "true" } });
    appendElement(ariaHiddenGroup, { role: "option", value: "under-aria-hidden" });
    appendElement(options, { role: "option", value: "b" });

    expect(values(getNavigationItems(options, { type: "option" }))).toEqual(["a", "b"]);
  });

  it("excludes items under aria-disabled and data-disabled ancestors by default", () => {
    const options = mountContainer("listbox");
    appendElement(options, { role: "option", value: "a" });
    const ariaDisabledGroup = appendElement(options, {
      attributes: { "aria-disabled": "true" },
    });
    appendElement(ariaDisabledGroup, { role: "option", value: "under-aria-disabled" });
    const dataDisabledGroup = appendElement(options, { attributes: { "data-disabled": "" } });
    appendElement(dataDisabledGroup, { role: "option", value: "under-data-disabled" });
    appendElement(options, { role: "option", value: "b" });

    expect(values(getNavigationItems(options, { type: "option" }))).toEqual(["a", "b"]);
    expect(values(getNavigationItems(options, { type: "option", skipDisabled: false }))).toEqual([
      "a",
      "under-aria-disabled",
      "under-data-disabled",
      "b",
    ]);
  });

  it("scopes owned roles to the outer listbox, menu, radiogroup, and tablist", () => {
    const cases: Array<{
      type: NavigationItemType;
      ownerRole: string;
      itemRole: string;
    }> = [
      { type: "option", ownerRole: "listbox", itemRole: "option" },
      { type: "menuitem", ownerRole: "menu", itemRole: "menuitem" },
      { type: "menuitemcheckbox", ownerRole: "menu", itemRole: "menuitemcheckbox" },
      { type: "radio", ownerRole: "radiogroup", itemRole: "radio" },
      { type: "tab", ownerRole: "tablist", itemRole: "tab" },
    ];

    for (const { type, ownerRole, itemRole } of cases) {
      const container = mountContainer(ownerRole);
      appendElement(container, { role: itemRole, value: `${type}-outer-a` });
      const nested = appendElement(container, { role: ownerRole });
      appendElement(nested, { role: itemRole, value: `${type}-nested` });
      appendElement(container, { role: itemRole, value: `${type}-outer-b` });

      expect(values(getNavigationItems(container, { type }))).toEqual([
        `${type}-outer-a`,
        `${type}-outer-b`,
      ]);
    }
  });

  it("allows nested owners when ownerSelector is null", () => {
    const container = mountContainer("listbox");
    appendElement(container, { role: "option", value: "outer" });
    const nested = appendElement(container, { role: "listbox" });
    appendElement(nested, { role: "option", value: "nested" });

    expect(values(getNavigationItems(container, { type: "option", ownerSelector: null }))).toEqual([
      "outer",
      "nested",
    ]);
  });

  it("supports empty string values and public item props", () => {
    const container = mountContainer("listbox");
    const props = getNavigationItemProps("option", "");
    const emptyItem = appendElement(container, {
      tabIndex: -1,
      value: props["data-value"],
      attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: props["data-diffgazer-navigation-item"] },
    });

    expect(findNavigationItemByValue(container, { type: "option", value: "" })).toBe(emptyItem);
    expect(focusNavigationItem(container, { type: "option", value: "" })).toBe("");
    expect(document.activeElement).toBe(emptyItem);
  });

  it("finds focused descendants and exposes active containment", () => {
    const container = mountContainer("listbox");
    const item = appendElement(container, { role: "option", value: "parent" });
    const child = appendElement(item, { tag: "button", text: "Child" });

    child.focus();

    expect(containsActiveElement(item)).toBe(true);
    expect(getFocusedNavigationValue(container, { type: "option" })).toBe("parent");
  });

  it("focuses by value with fallback behavior", () => {
    const container = mountContainer("group");
    const first = appendElement(container, { tag: "button", value: "first", text: "First" });
    const last = appendElement(container, { tag: "button", value: "last", text: "Last" });

    expect(focusNavigationItem(container, { type: "button", value: "last" })).toBe("last");
    expect(document.activeElement).toBe(last);

    first.focus();
    expect(focusNavigationItem(container, { type: "button", value: "missing" })).toBeNull();
    expect(document.activeElement).toBe(first);

    expect(
      focusNavigationItem(container, { type: "button", value: "missing", fallback: "last" }),
    ).toBe("last");
    expect(document.activeElement).toBe(last);
  });

  it("returns mixed-selector items sorted by DOM order", () => {
    const container = mountContainer("listbox");
    appendElement(container, { role: "option", value: "role-first" });
    appendElement(container, {
      value: "contract-second",
      attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "option" },
    });
    appendElement(container, { role: "option", value: "role-third" });

    expect(values(getNavigationItems(container, { type: "option" }))).toEqual([
      "role-first",
      "contract-second",
      "role-third",
    ]);
  });

  it("deduplicates elements matched by multiple selectors", () => {
    const container = mountContainer("listbox");
    appendElement(container, {
      role: "option",
      value: "both",
      attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "option" },
    });
    appendElement(container, { role: "option", value: "role-only" });

    expect(values(getNavigationItems(container, { type: "option" }))).toEqual([
      "both",
      "role-only",
    ]);
  });

  it("matches unsafe data values without interpolating them into selectors", () => {
    const container = mountContainer("listbox");
    const unsafeValue = 'a"] [data-value="b';
    const unsafeItem = appendElement(container, { role: "option", value: unsafeValue });
    appendElement(container, { role: "option", value: "b" });

    expect(findNavigationItemByValue(container, { type: "option", value: unsafeValue })).toBe(
      unsafeItem,
    );
  });
});
