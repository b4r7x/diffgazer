import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "./bootstrap";
import { mountLanding } from "./testing/markup";

let cleanup = () => {};

/** Reduced motion throughout; `matches` decides every other query under test. */
function bootLanding(matches: (query: string) => boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") || matches(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  mountLanding();
  cleanup = bootstrap(document);
}

const diffRows = () => document.querySelector<HTMLElement>("#gz-diff");

describe("landing accessibility contracts", () => {
  describe("bootstrap under reduced motion", () => {
    afterEach(() => {
      cleanup();
      cleanup = () => {};
      vi.unstubAllGlobals();
      document.body.innerHTML = "";
    });

    it("keeps the diff scroller in the tab order while it really scrolls", () => {
      bootLanding(() => false);

      expect(diffRows()?.tabIndex).toBe(0);
      expect(diffRows()?.getAttribute("aria-label")).toBe("Example diff rows");
    });

    it("drops the tab stop where the diff clips to an ellipsis instead of scrolling", () => {
      bootLanding((query) => query.includes("max-width: 700px"));

      expect(diffRows()?.hasAttribute("tabindex")).toBe(false);
      expect(diffRows()?.hasAttribute("aria-label")).toBe(false);
    });
  });

  describe("static markup", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("announces copy state through a polite live region without losing the action label", () => {
      mountLanding();

      const buttons = [...document.querySelectorAll<HTMLButtonElement>(".copy-btn")];

      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        expect(button.getAttribute("aria-label")).toBe("Copy install command");
        expect(button.querySelector(".copy-label")?.getAttribute("aria-live")).toBe("polite");
      }
    });

    it("names the HUD wordmark once, with the ascii art hidden from the a11y tree", () => {
      mountLanding();

      const wordmark = document.querySelector<HTMLElement>(".hud-tl");
      const figlet = wordmark?.querySelector<HTMLElement>(".logo-figlet");

      // One canonical accessible spelling across landing, web, and docs: the
      // brand is lowercase, however loudly the ascii art renders it.
      expect(wordmark?.getAttribute("aria-label")).toBe("diffgazer");
      // The figlet is the mark at every width now, so there is no second
      // letter-spaced variant to hide or to name.
      expect(figlet?.getAttribute("aria-hidden")).toBe("true");
      expect(wordmark?.querySelector(".logo-word")).toBeNull();
    });

    it("exposes the install figlet as a single labeled image, not raw ascii", () => {
      mountLanding();

      const figlet = document.querySelector<HTMLElement>("#figlet");

      expect(figlet?.getAttribute("role")).toBe("img");
      expect(figlet?.getAttribute("aria-label")).toBe("diffgazer");
    });
  });
});
