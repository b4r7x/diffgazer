/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  composedClosest,
  composedContains,
  getComposedEventTarget,
  getOwnerView,
  getShadowHost,
  isEditableElement,
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

describe("foreign realm (iframe)", () => {
  it("recognizes elements created in an iframe's document as real DOM elements", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    try {
      const iframeDocument = iframe.contentDocument;
      if (!iframeDocument) throw new Error("iframe contentDocument is null");
      const div = iframeDocument.createElement("div");
      const input = iframeDocument.createElement("input");
      const textarea = iframeDocument.createElement("textarea");

      expect(getOwnerView(div)).toBe(iframe.contentWindow);
      expect(isHTMLElement(div)).toBe(true);
      expect(isHTMLInputElement(input)).toBe(true);
      expect(isHTMLTextAreaElement(textarea)).toBe(true);
    } finally {
      iframe.remove();
    }
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

describe("composed tree traversal", () => {
  let host: HTMLDivElement;
  let innerHost: HTMLDivElement;
  let leaf: HTMLInputElement;

  beforeEach(() => {
    host = document.createElement("div");
    host.className = "outer-host";
    document.body.appendChild(host);
    innerHost = document.createElement("div");
    host.attachShadow({ mode: "open" }).appendChild(innerHost);
    leaf = document.createElement("input");
    innerHost.attachShadow({ mode: "open" }).appendChild(leaf);
  });

  afterEach(() => {
    host.remove();
  });

  describe("getShadowHost", () => {
    it("returns the host of the shadow root a node lives in", () => {
      expect(getShadowHost(leaf)).toBe(innerHost);
      expect(getShadowHost(innerHost)).toBe(host);
    });

    it("returns null for a light-DOM node", () => {
      expect(getShadowHost(host)).toBeNull();
    });
  });

  describe("composedContains", () => {
    it("crosses every shadow boundary between target and container", () => {
      expect(composedContains(host, leaf)).toBe(true);
      expect(composedContains(document.body, leaf)).toBe(true);
    });

    it("returns false for a detached target and for null", () => {
      expect(composedContains(host, document.createElement("div"))).toBe(false);
      expect(composedContains(host, null)).toBe(false);
    });
  });

  describe("composedClosest", () => {
    it("matches a selector on an ancestor shadow host", () => {
      expect(composedClosest(leaf, ".outer-host")).toBe(host);
    });

    it("returns null when nothing in the composed ancestry matches", () => {
      expect(composedClosest(leaf, ".absent")).toBeNull();
    });
  });
});

describe("isInputElement", () => {
  it.each(["input", "textarea", "select"])("classifies native <%s> as an input element", (tag) => {
    expect(isInputElement(document.createElement(tag))).toBe(true);
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

  it("returns false for null", () => {
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
