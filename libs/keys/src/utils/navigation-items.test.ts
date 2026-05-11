import { afterEach, describe, expect, it } from "vitest";
import {
  NAVIGATION_ITEM_ATTRIBUTE,
  containsActiveElement,
  findNavigationItemByValue,
  focusNavigationItem,
  getFocusableElements,
  getFocusedNavigationValue,
  getNavigationItemProps,
  getNavigationItems,
  type NavigationItemType,
} from "./navigation-items";

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

describe("navigation item utilities", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("queries data-contract items before role fallbacks", () => {
    const container = mountContainer("listbox");
    appendElement(container, {
      value: "contract",
      attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "option" },
    });
    appendElement(container, { role: "option", value: "role" });
    appendElement(container, { attributes: { [NAVIGATION_ITEM_ATTRIBUTE]: "option" } });

    expect(values(getNavigationItems(container, { type: "option" }))).toEqual([
      "contract",
    ]);
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
    expect(values(getNavigationItems(checkboxes, { type: "checkbox" }))).toEqual(["bold", "italic"]);
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

    expect(values(getNavigationItems(container, { type: "menuitem" }))).toEqual([
      "open",
      "close",
    ]);
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

    expect(focusNavigationItem(container, { type: "button", value: "missing", fallback: "last" })).toBe("last");
    expect(document.activeElement).toBe(last);
  });

  it("matches unsafe data values without interpolating them into selectors", () => {
    const container = mountContainer("listbox");
    const unsafeValue = 'a"] [data-value="b';
    const unsafeItem = appendElement(container, { role: "option", value: unsafeValue });
    appendElement(container, { role: "option", value: "b" });

    expect(findNavigationItemByValue(container, { type: "option", value: unsafeValue })).toBe(unsafeItem);
  });

  it("returns focusable descendants including programmatic focus targets", () => {
    const container = mountContainer();
    appendElement(container, { tag: "button", text: "Button" });
    appendElement(container, { tag: "button", text: "Disabled", attributes: { disabled: "" } });
    appendElement(container, { tag: "a", text: "Link", attributes: { href: "#" } });
    appendElement(container, { text: "Programmatic", tabIndex: 0 });
    appendElement(container, { text: "Skipped", tabIndex: -1 });

    expect(getFocusableElements(container).map((element) => element.textContent)).toEqual([
      "Button",
      "Link",
      "Programmatic",
      "Skipped",
    ]);
  });
});
