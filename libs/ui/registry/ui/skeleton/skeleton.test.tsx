import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { atRuleBody, ruleBody } from "../../testing/css-contract";
import { Skeleton } from "./index";

describe("Skeleton", () => {
  it("renders decorative placeholder hidden from assistive tech", async () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps aria-hidden="true" when spread consumer props include a conflicting aria-hidden value', () => {
    const consumerProps: ComponentProps<"div"> = { "aria-hidden": "false" };
    const { container } = render(<Skeleton {...consumerProps} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards consumer style for dimensions", () => {
    const { container } = render(<Skeleton style={{ height: 16, width: 128 }} />);
    const el = container.firstElementChild;
    expect(el).toHaveStyle({ height: "16px", width: "128px" });
  });

  it("spreads additional HTML attributes", () => {
    const { container } = render(<Skeleton id="loading-placeholder" />);
    expect(container.firstElementChild).toHaveAttribute("id", "loading-placeholder");
  });

  it("sizes in character cells via --skeleton-chars instead of an inline width", () => {
    const { container } = render(<Skeleton chars={12} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el).toHaveAttribute("data-chars", "12");
    expect(el.style.getPropertyValue("--skeleton-chars")).toBe("12");
    expect(el.style.width).toBe("");
  });

  it("keeps consumer style when chars is set and stays cell-free when it is not", () => {
    const { container, rerender } = render(<Skeleton chars={7} style={{ height: 16 }} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveStyle({ height: "16px" });
    expect(el.style.getPropertyValue("--skeleton-chars")).toBe("7");

    rerender(<Skeleton style={{ height: 16 }} />);
    expect(container.firstElementChild).not.toHaveAttribute("data-chars");
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue("--skeleton-chars"),
    ).toBe("");
  });

  it("carries no rounding class of its own", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild?.className).toBe("");
  });
});

describe("Skeleton CSS contract", () => {
  // jsdom applies no stylesheet and drops @layer-nested rules from its CSSOM,
  // so the shipped source is the contract.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../skeleton.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  it("draws hard-edged cells rather than a rounded blob", () => {
    const root = ruleBody(css, '[data-slot="skeleton"]');
    expect(root).not.toBeNull();
    expect(root).toContain("border-radius: 0");
    expect(root).toContain("mask-image: repeating-linear-gradient");
    expect(root).not.toContain("border-radius: 50%");
  });

  it("drops the scan sweep under prefers-reduced-motion", () => {
    const reduced = atRuleBody(css, "@media (prefers-reduced-motion: reduce)");
    const sweep = ruleBody(reduced, '[data-slot="skeleton"]::after');
    expect(sweep).not.toBeNull();
    expect(sweep).toContain("content: none");
  });

  it("falls back to an outlined band in forced colors", () => {
    const forced = atRuleBody(css, "@media (forced-colors: active)");
    const root = ruleBody(forced, '[data-slot="skeleton"]');
    expect(root).not.toBeNull();
    expect(root).toContain("mask-image: none");
    expect(root).toContain("border: 1px solid GrayText");
  });
});
