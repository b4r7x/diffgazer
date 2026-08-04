import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffgazerWordmark, type WordmarkTier } from "./wordmark";

/**
 * Tailwind font-size utilities, breakpoint variants included: `text-sm`,
 * `text-sm/[1.3333]`, `sm:text-lg`, `text-[13px]`. Colour utilities such as
 * `text-info-text` are not sizes and must be free to change per tier.
 */
function fontSizeTokens(element: Element | null): string[] {
  return classTokens(element).filter((token) => /(^|:)text-(xs|sm|base|lg|\d*xl|\[)/.test(token));
}

/** The tier scale the frame declares — `[--wm-scale:0.5]`, `lg:[--wm-scale:0.75]`. */
function scaleTokens(element: Element | null): string[] {
  return classTokens(element).filter((token) => token.includes("[--wm-scale:"));
}

function classTokens(element: Element | null): string[] {
  return [...(element?.classList ?? [])];
}

function renderTier(tier: WordmarkTier) {
  const { container } = render(<DiffgazerWordmark tier={tier} />);
  return {
    frame: container.firstElementChild,
    block: within(container).getByRole("img", { name: "diffgazer" }),
  };
}

describe("DiffgazerWordmark", () => {
  it("announces the same lowercase brand at every tier", () => {
    expect(renderTier("hero").block).toBeInTheDocument();
    expect(renderTier("dense").block).toBeInTheDocument();
  });

  it("renders one canonical block, six rows deep, at every tier", () => {
    const hero = renderTier("hero");
    const dense = renderTier("dense");

    const rows = hero.block.textContent?.split("\n") ?? [];
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.trim().length > 0)).toBe(true);
    expect(dense.block.textContent).toBe(hero.block.textContent);
  });

  it("sizes a tier by scaling that block, never by restyling it", () => {
    const hero = renderTier("hero");
    const dense = renderTier("dense");

    // The block is the constant and the frame's scale is the only thing a tier
    // moves. jsdom computes no styles from Tailwind, so the class list is where a
    // per-tier font size — the thing that would re-render the art at another cell
    // size and dash out its strokes — would show up.
    expect(fontSizeTokens(hero.block).length).toBeGreaterThan(0);
    expect(fontSizeTokens(dense.block)).toEqual(fontSizeTokens(hero.block));
    expect(scaleTokens(hero.frame).length).toBeGreaterThan(0);
    expect(scaleTokens(dense.frame)).not.toEqual(scaleTokens(hero.frame));
  });
});
