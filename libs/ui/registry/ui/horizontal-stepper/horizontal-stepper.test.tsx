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

  it("keeps the screen-reader status text outside the split glyph", () => {
    renderStepper("config", "ascii");
    const config = closestElement(screen.getByText("Config"), "li", "Config list item");

    // The glyph is three spans (chrome, mark, chrome) plus the sr-only status span; the status
    // text must stay a sibling of the split so it is never read as part of the glyph.
    expect(screen.getByText("Current:")).toHaveClass("sr-only");
    expect(config).toHaveTextContent("[~]");
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

  it("derives the window threshold from the step count, not from a blanket width", () => {
    // Same class-as-contract rationale as the test above: the threshold literals are the only
    // thing that makes the window engage from need. A four-step run keeps its full run down to
    // 18rem, where a twelve-step run of the same variant has to window from 32rem — a blanket
    // threshold would elide steps at widths where the short run fits trivially.
    function renderRun(total: number) {
      const ids = Array.from({ length: total }, (_, index) => `s${index}`);
      return render(
        <HorizontalStepper steps={ids} value="s1" aria-label="Run">
          {ids.map((id) => (
            <HorizontalStepper.Step key={id} value={id}>
              {id}
            </HorizontalStepper.Step>
          ))}
        </HorizontalStepper>,
      );
    }

    const four = renderRun(4);
    expect(closestElement(screen.getByText("s3"), "li", "last step")).toHaveClass(
      "@max-[18rem]/horizontal-stepper:sr-only",
    );
    four.unmount();

    const twelve = renderRun(12);
    expect(closestElement(screen.getByText("s11"), "li", "last step")).toHaveClass(
      "@max-[32rem]/horizontal-stepper:sr-only",
    );
    twelve.unmount();

    // Three steps ARE the window, so no window threshold and no markers can ever apply. (The
    // 14rem active-only tier is a different collapse and still rides along.)
    renderRun(3);
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).not.toMatch(/@max-\[(18|22|26|32|40|48|64)rem\]/);
    }
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("keeps the active glyph below 14rem instead of dropping the run", () => {
    renderStepper("config", "ascii", true);

    // The narrowest tier rides the container query even when compact is forced, because a
    // forced-compact stepper can still land in a container too narrow for a three-cell window.
    const intro = closestElement(screen.getByText("Intro"), "li", "Intro list item");
    const config = closestElement(screen.getByText("Config"), "li", "Config list item");
    expect(intro).toHaveClass("@max-[14rem]/horizontal-stepper:sr-only");
    // The active step stays whole — glyph included. A progress indicator that shows no progress
    // is the failure this tier used to produce.
    expect(config).not.toHaveClass("@max-[14rem]/horizontal-stepper:sr-only");
    expect(config).toHaveTextContent("[~]");
    expect(config).toHaveTextContent("Step 2/4");
  });

  it("keeps every step announced in the active-only tier", () => {
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

describe("HorizontalStepper window", () => {
  const seven = ["a", "b", "c", "d", "e", "f", "g"];

  function renderSeven(active: string, variant?: "ascii" | "numbered" | "breadcrumb") {
    return render(
      <HorizontalStepper steps={seven} value={active} variant={variant} compact aria-label="Run">
        {seven.map((step) => (
          <HorizontalStepper.Step key={step} value={step}>
            {step.toUpperCase()}
          </HorizontalStepper.Step>
        ))}
      </HorizontalStepper>,
    );
  }

  it("counts the elided steps on either side of the window", () => {
    renderSeven("d");

    // active index 3 of 7 → the window keeps steps 2-4, so two steps fall outside on each side.
    const markers = screen.getAllByText(/^\+\d+$/);
    expect(markers.map((marker) => marker.textContent)).toEqual(["+2", "+2"]);
    for (const marker of markers) expect(marker).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps every step in the accessibility tree while the window is engaged", () => {
    renderSeven("d");

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getAllByText(/^(Completed|Current|Upcoming):$/)).toHaveLength(7);
    expect(
      screen
        .getAllByRole("listitem")
        .filter((item) => item.getAttribute("aria-current") === "step"),
    ).toHaveLength(1);
  });

  it("renders no markers when the run is short enough to be its own window", () => {
    render(
      <HorizontalStepper steps={["a", "b", "c"]} value="b" compact aria-label="Run">
        <HorizontalStepper.Step value="a">A</HorizontalStepper.Step>
        <HorizontalStepper.Step value="b">B</HorizontalStepper.Step>
        <HorizontalStepper.Step value="c">C</HorizontalStepper.Step>
      </HorizontalStepper>,
    );

    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("omits the marker on the side that has nothing hidden", () => {
    renderSeven("b");
    // active index 1 → nothing hidden before, four steps hidden after.
    expect(screen.getAllByText(/^\+\d+$/).map((m) => m.textContent)).toEqual(["+4"]);
  });

  it("keeps the active glyph in every variant under the window", () => {
    for (const variant of ["ascii", "breadcrumb"] as const) {
      const { unmount } = renderSeven("d", variant);
      const active = closestElement(screen.getByText("D"), "li", "active list item");
      expect(active).toHaveAttribute("aria-current", "step");
      expect(active.textContent).not.toBe("");
      unmount();
    }
  });

  it("has no a11y violations with the window engaged", async () => {
    const { container } = renderSeven("d");
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
