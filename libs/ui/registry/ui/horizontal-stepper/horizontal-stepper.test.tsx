import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { closestElement } from "../../testing/assertions";
import { HorizontalStepper } from "./index";

const steps = ["intro", "config", "review", "done"];

function renderStepper(
  activeStep: string,
  variant?: "ascii" | "numbered" | "breadcrumb",
  compact?: boolean,
) {
  return render(
    <HorizontalStepper
      steps={steps}
      value={activeStep}
      variant={variant}
      compact={compact}
      aria-label="Setup progress"
    >
      <HorizontalStepper.Step value="intro">Intro</HorizontalStepper.Step>
      <HorizontalStepper.Step value="config">Config</HorizontalStepper.Step>
      <HorizontalStepper.Step value="review">Review</HorizontalStepper.Step>
      <HorizontalStepper.Step value="done">Done</HorizontalStepper.Step>
    </HorizontalStepper>,
  );
}

describe("HorizontalStepper", () => {
  it("marks active step and provides screen reader labels for all statuses", () => {
    renderStepper("config");
    const configItem = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(configItem).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Current:")).toBeInTheDocument();

    const introItem = closestElement(screen.getByText("Intro"), "li", "Intro list item");
    expect(introItem).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Completed:")).toBeInTheDocument();

    expect(screen.getAllByText("Upcoming:")).toHaveLength(2);
  });

  it("renders as an ordered list with aria-label", () => {
    renderStepper("intro");
    const list = screen.getByRole("list", { name: "Setup progress" });
    expect(list).toBeInTheDocument();
    // 4 real steps + 3 ascii connector presentational <li>s
    const allItems = list.querySelectorAll("li");
    expect(allItems).toHaveLength(7);
    // Only the 4 steps expose listitem semantics (presentation role hides connectors)
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("falls back to the default Progress list name when aria-label is omitted", () => {
    render(
      <HorizontalStepper steps={steps} value="intro">
        <HorizontalStepper.Step value="intro">Intro</HorizontalStepper.Step>
        <HorizontalStepper.Step value="config">Config</HorizontalStepper.Step>
        <HorizontalStepper.Step value="review">Review</HorizontalStepper.Step>
        <HorizontalStepper.Step value="done">Done</HorizontalStepper.Step>
      </HorizontalStepper>,
    );
    expect(screen.getByRole("list", { name: "Progress" })).toBeInTheDocument();
  });

  it("uses the value prop as the current step contract", () => {
    renderStepper("review");

    expect(screen.getByText("Review").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Config").closest("li")).not.toHaveAttribute("aria-current");
  });

  it("has no a11y violations", async () => {
    const { container } = renderStepper("config");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("writes data-variant on the root list", () => {
    renderStepper("config", "numbered");
    expect(screen.getByRole("list", { name: "Setup progress" })).toHaveAttribute(
      "data-variant",
      "numbered",
    );
  });
});

describe("HorizontalStepper ascii variant", () => {
  it("renders [x] / [~] / [ ] glyphs per status", () => {
    renderStepper("config", "ascii");
    const intro = closestElement(screen.getByText("Intro"), "li", "Intro list item");
    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    const review = closestElement(screen.getByText("Review"), "li", "Review list item");

    expect(intro).toHaveTextContent("[x]");
    expect(config).toHaveTextContent("[~]");
    expect(review).toHaveTextContent("[ ]");
  });

  it("interleaves ── connectors between steps", () => {
    const { container } = renderStepper("config", "ascii");
    const presentations = container.querySelectorAll('[role="presentation"]');
    // 4 steps → 3 connectors
    expect(presentations.length).toBe(3);
    expect(presentations[0]).toHaveTextContent("───");
  });
});

describe("HorizontalStepper numbered variant", () => {
  it("renders ✓ for completed and an empty counter placeholder for active/pending", () => {
    renderStepper("config", "numbered");
    const intro = closestElement(screen.getByText("Intro"), "li", "Intro list item");
    expect(intro).toHaveTextContent("✓");
    // Active/pending render an empty <span data-counter> — assert presence rather
    // than glyph (the digit comes from CSS counter via ::before, which jsdom
    // does not paint).
    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(config.querySelector("[data-counter]")).toBeTruthy();
  });

  it("does not interleave presentational connector <li>s — the bar is a ::before pseudo on each step", () => {
    const { container } = renderStepper("config", "numbered");
    const presentations = container.querySelectorAll('[role="presentation"]');
    expect(presentations.length).toBe(0);
  });
});

describe("HorizontalStepper constrained containers", () => {
  // The overflow contract is a layout guarantee jsdom cannot measure, so these assert the classes
  // that carry it. They are the contract, not incidental styling: dropping `whitespace-nowrap` or
  // `shrink-0` is exactly how labels wrapped mid-word and the `[ ]` glyph split across two lines.
  it("never lets a step or a connector break internally", () => {
    const { container } = renderStepper("config");

    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveClass("whitespace-nowrap");
      expect(item).toHaveClass("shrink-0");
    }
    for (const connector of container.querySelectorAll('[role="presentation"]')) {
      expect(connector).toHaveClass("whitespace-nowrap");
      expect(connector).toHaveClass("shrink-0");
    }
  });

  it("collapses on its own container width, not on the viewport", () => {
    const { container } = renderStepper("config");

    // The root is the query container; children collapse below 36rem of it.
    expect(screen.getByRole("list", { name: "Setup progress" })).toHaveClass(
      "@container/horizontal-stepper",
    );
    const connector = container.querySelector('[role="presentation"]');
    expect(connector).toHaveClass("@max-xl/horizontal-stepper:hidden");
    // Not unconditionally hidden: a wide container keeps the full stepper.
    expect(connector).not.toHaveClass("hidden");
  });

  it("carries the container-query compact classes on the steps and labels", () => {
    renderStepper("config");

    // The default path only ever emits these two through the container-query branch, and a
    // class built by interpolating the `@max-xl/horizontal-stepper:` prefix onto a variable
    // is invisible to Tailwind's scanner — it ships the bare prefix and no utility reaches
    // the stylesheet. Asserting the forced-compact branch alone (bare `pe-1.5`/`sr-only`)
    // cannot catch that, so both branches are pinned.
    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(config).toHaveClass("@max-xl/horizontal-stepper:pe-1.5");
    expect(config).not.toHaveClass("pe-1.5");
    expect(screen.getByText("Review")).toHaveClass("@max-xl/horizontal-stepper:sr-only");
    expect(screen.getByText("Review")).not.toHaveClass("sr-only");
  });

  it("drops the glyph run below 20rem so only the step text is left", () => {
    renderStepper("config", "ascii", true);

    // Tier 2 rides the container query even when compact is forced, because a forced-compact
    // stepper can still land in a container too narrow for its glyph run.
    const intro = closestElement(screen.getByText("Intro"), "li", "Intro list item");
    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(intro).toHaveClass("@max-xs/horizontal-stepper:sr-only");
    // The active step stays: it carries the text the tier is named for.
    expect(config).not.toHaveClass("@max-xs/horizontal-stepper:sr-only");
    expect(config.querySelector("span")).toHaveClass("@max-xs/horizontal-stepper:sr-only");
    expect(config).toHaveTextContent("Step 2/4");
  });

  it("keeps every step announced in the text-only tier", () => {
    renderStepper("config", "ascii", true);

    // sr-only, not hidden: the collapsed steps leave the layout, not the accessibility tree.
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});

describe("HorizontalStepper compact", () => {
  it("labels only the active step and prefixes it with the step count", () => {
    renderStepper("config", "ascii", true);

    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(config).toHaveTextContent("Step 2/4");

    const counter = config.querySelector('[aria-hidden="true"]');
    // List position and aria-current already announce this, so it stays visual-only.
    expect(counter).toHaveTextContent("Step 2/4");

    const intro = closestElement(screen.getByText("Intro"), "li", "Intro list item");
    expect(intro).not.toHaveTextContent("Step");
  });

  it("keeps the glyph run intact and hides the connectors", () => {
    const { container } = renderStepper("config", "ascii", true);

    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(config).toHaveTextContent("[~]");
    for (const connector of container.querySelectorAll('[role="presentation"]')) {
      expect(connector).toHaveClass("hidden");
      // The display decision lives entirely in the compact branch, so the forced-compact
      // connector carries `hidden` and nothing else — this is what stopped the run from
      // pushing to 430px in a 287px card.
      expect(connector).not.toHaveClass("inline-flex");
    }
  });

  it("keeps the labelled step clear of the glyph that follows it", () => {
    renderStepper("config", "ascii", true);

    // The label sits inside the glyph run once the connectors and their margins are gone, so
    // without trailing space the next step's `[ ]` renders as part of the last word.
    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(config).toHaveClass("pe-1.5");
    expect(closestElement(screen.getByText("Review"), "li", "Review list item")).not.toHaveClass(
      "pe-1.5",
    );
  });

  it("hides non-active labels visually but keeps them for assistive tech", () => {
    renderStepper("config", "ascii", true);

    // Still queryable — sr-only removes the label from the layout, not from the a11y tree.
    expect(screen.getByText("Review")).toHaveClass("sr-only");
    expect(screen.getByText("Config")).not.toHaveClass("sr-only");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("has no a11y violations", async () => {
    const { container } = renderStepper("config", "ascii", true);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("HorizontalStepper breadcrumb variant", () => {
  it("renders ✓ / › glyphs for completed/active and suppresses pending glyph", () => {
    renderStepper("config", "breadcrumb");
    const intro = closestElement(screen.getByText("Intro"), "li", "Intro list item");
    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(intro).toHaveTextContent("✓");
    expect(config).toHaveTextContent("›");
  });

  it("interleaves / separators between steps", () => {
    const { container } = renderStepper("config", "breadcrumb");
    const presentations = container.querySelectorAll('[role="presentation"]');
    expect(presentations.length).toBe(3);
    expect(presentations[0]).toHaveTextContent("/");
  });
});
