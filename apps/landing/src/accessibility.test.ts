import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "./bootstrap";
import { mountLanding } from "./testing/markup";

let cleanup = () => {};

function stubReducedMotion(): void {
  const reducedQuery = {
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };

  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("prefers-reduced-motion")
      ? reducedQuery
      : { ...reducedQuery, matches: true, media: query },
  );
}

describe("landing accessibility contracts", () => {
  describe("bootstrap under reduced motion", () => {
    beforeEach(() => {
      stubReducedMotion();
      mountLanding();
      cleanup = bootstrap(document);
    });

    afterEach(() => {
      cleanup();
      cleanup = () => {};
      vi.unstubAllGlobals();
    });

    it("makes the mobile diff scroller keyboard focusable", () => {
      const diffRows = document.querySelector<HTMLElement>("#gz-diff");

      expect(diffRows?.tabIndex).toBe(0);
      expect(diffRows?.getAttribute("aria-label")).toBe("Example diff rows");
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

    it("exposes the install figlet as a single labeled image, not raw ascii", () => {
      mountLanding();

      const figlet = document.querySelector<HTMLElement>("#figlet");

      expect(figlet?.getAttribute("role")).toBe("img");
      expect(figlet?.getAttribute("aria-label")).toBe("Diffgazer");
    });
  });
});
