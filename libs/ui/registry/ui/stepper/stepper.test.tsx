import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { STEP_STATUSES, type StepStatus } from "@/lib/step-status";
import type { StepperVariant } from "@/lib/stepper-variants";
import { axe } from "../../../testing/axe";
import { requireElement, requireValue } from "../../testing/assertions";
import { getStepperIndicatorGlyph, Stepper } from "./index";

function renderStepper(props: Record<string, unknown> = {}) {
  return render(
    <Stepper {...props}>
      <Stepper.Step stepId="s1" status="completed">
        <Stepper.Trigger>Step 1</Stepper.Trigger>
        <Stepper.Content>Content 1</Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="s2" status="active">
        <Stepper.Trigger>Step 2</Stepper.Trigger>
        <Stepper.Content>Content 2</Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="s3" status="pending">
        <Stepper.Trigger>Step 3</Stepper.Trigger>
        <Stepper.Content>Content 3</Stepper.Content>
      </Stepper.Step>
    </Stepper>,
  );
}

describe("Stepper", () => {
  it("expands step content when trigger is clicked", async () => {
    renderStepper();
    const trigger = screen.getByRole("button", { name: /Step 1/ });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", { name: /Step 1/ });
    expect(region).not.toHaveAttribute("aria-hidden");
  });

  it("collapses an expanded step when trigger is clicked again", async () => {
    renderStepper({ defaultExpandedIds: ["s1"] });
    const trigger = screen.getByRole("button", { name: /Step 1/ });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("expands steps matching defaultExpandedIds initially", () => {
    renderStepper({ defaultExpandedIds: ["s1", "s2"] });
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Step 3/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("fires onExpandedChange in controlled mode", async () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <Stepper expandedIds={[]} onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Step 1/ }));
    expect(onExpandedChange).toHaveBeenCalledWith(["s1"]);
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    rerender(
      <Stepper expandedIds={["s1"]} onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("calls consumer trigger onClick before expanding", async () => {
    const onClick = vi.fn();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger onClick={onClick}>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    const trigger = screen.getByRole("button", { name: /Step 1/ });

    await userEvent.click(trigger);

    expect(onClick).toHaveBeenCalled();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("does not expand when trigger click is prevented", async () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger onClick={(event) => event.preventDefault()}>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    const trigger = screen.getByRole("button", { name: /Step 1/ });

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("only emits aria-controls when the referenced content exists", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>With content</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="pending">
          <Stepper.Trigger>No content</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const withContent = screen.getByRole("button", { name: /With content/ });
    const withoutContent = screen.getByRole("button", { name: /No content/ });
    const contentId = requireValue(
      withContent.getAttribute("aria-controls"),
      "step content aria-controls",
    );

    expect(requireElement(document.getElementById(contentId), "step content")).toBeInTheDocument();
    expect(withoutContent).not.toHaveAttribute("aria-controls");
    expect(withoutContent).not.toHaveAttribute("aria-expanded");
  });

  it("does not toggle steps that have no content", async () => {
    const onExpandedChange = vi.fn();
    render(
      <Stepper onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>No content</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const trigger = screen.getByRole("button", { name: /No content/ });
    await userEvent.click(trigger);

    expect(onExpandedChange).not.toHaveBeenCalled();
    expect(trigger).not.toHaveAttribute("aria-expanded");
  });

  it("has no a11y violations", async () => {
    const { container } = renderStepper({ defaultExpandedIds: ["s1"] });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the default tag glyphs when variant="tag"', () => {
    render(
      <Stepper variant="tag">
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s4" status="error">
          <Stepper.Trigger>Step 4</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveTextContent("DONE");
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveTextContent("RUN");
    expect(screen.getByRole("button", { name: /Step 3/ })).toHaveTextContent("WAIT");
    expect(screen.getByRole("button", { name: /Step 4/ })).toHaveTextContent("FAIL");
  });

  it("uses provided statusLabels for tag-variant indicators", () => {
    render(
      <Stepper variant="tag">
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger statusLabels={{ completed: "PASS", active: "WORK" }}>
            Step 1
          </Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger statusLabels={{ completed: "PASS", active: "WORK" }}>
            Step 2
          </Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveTextContent("PASS");
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveTextContent("WORK");
  });

  it("uses provided statusLabels for substep fallback text", () => {
    render(
      <Stepper defaultExpandedIds={["s1"]}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <Stepper.Substep
              tag="A"
              label="Substep A"
              status="active"
              statusLabels={{ active: "analyzing..." }}
            />
            <Stepper.Substep tag="B" label="Substep B" status="completed" detail="custom detail" />
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByText("analyzing...")).toBeInTheDocument();
    // detail wins over statusLabels fallback
    expect(screen.getByText("custom detail")).toBeInTheDocument();
  });

  it("places a single tab stop on the active step (roving tabIndex)", async () => {
    const user = userEvent.setup();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const active = screen.getByRole("button", { name: /Step 2/ });
    const completed = screen.getByRole("button", { name: /Step 1/ });
    const pending = screen.getByRole("button", { name: /Step 3/ });

    expect(active).toHaveAttribute("tabIndex", "0");
    expect(completed).toHaveAttribute("tabIndex", "-1");
    expect(pending).toHaveAttribute("tabIndex", "-1");

    await user.tab();
    expect(active).toHaveFocus();
  });

  it("moves focus with arrow keys and Home/End, skipping disabled steps", async () => {
    const user = userEvent.setup();
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="disabled">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="active">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s4" status="pending">
          <Stepper.Trigger>Step 4</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const s1 = screen.getByRole("button", { name: /Step 1/ });
    const s3 = screen.getByRole("button", { name: /Step 3/ });
    const s4 = screen.getByRole("button", { name: /Step 4/ });

    s1.focus();
    expect(s1).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(s3).toHaveFocus(); // Step 2 is disabled — skipped

    await user.keyboard("{End}");
    expect(s4).toHaveFocus();

    await user.keyboard("{Home}");
    expect(s1).toHaveFocus();
  });

  it("marks disabled steps with aria-disabled and excludes them from tab order", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="disabled">
          <Stepper.Trigger>Locked step</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Open step</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const disabled = screen.getByRole("button", { name: /Locked step/ });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(disabled).toHaveAttribute("tabIndex", "-1");
  });

  it("renders a polite live region with the active step announcement", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Step 2 of 3: Step 2");
  });

  it("resolves the active step and its label through a consumer wrapper component", () => {
    function WrappedStep({
      stepId,
      status,
      label,
    }: {
      stepId: string;
      status: "completed" | "active" | "pending";
      label: string;
    }) {
      return (
        <Stepper.Step stepId={stepId} status={status}>
          <Stepper.Trigger>{label}</Stepper.Trigger>
        </Stepper.Step>
      );
    }

    render(
      <Stepper>
        <WrappedStep stepId="s1" status="completed" label="Step 1" />
        <WrappedStep stepId="s2" status="active" label="Step 2" />
        <WrappedStep stepId="s3" status="pending" label="Step 3" />
      </Stepper>,
    );

    // The static child walk cannot see through WrappedStep; registration keeps the
    // live-region position and label correct.
    expect(screen.getByRole("status")).toHaveTextContent("Step 2 of 3: Step 2");
  });
});

// ============================================================================
// Variant matrix — each variant renders a distinct indicator per state. We
// assert text content of the indicator span, not Tailwind classes.
// ============================================================================
describe("Stepper variant indicators", () => {
  const STATIC_VARIANTS = [
    "ascii",
    "bullet",
    "tag",
    "progress",
  ] as const satisfies readonly StepperVariant[];

  it.each(STATIC_VARIANTS)("renders the %s glyph dictionary", (variant) => {
    render(
      <Stepper variant={variant}>
        {STEP_STATUSES.map((status, idx) => (
          <Stepper.Step key={status} stepId={`s${idx}`} status={status}>
            <Stepper.Trigger>{`Label-${status}`}</Stepper.Trigger>
          </Stepper.Step>
        ))}
      </Stepper>,
    );

    for (const status of STEP_STATUSES) {
      const trigger = screen.getByRole("button", { name: new RegExp(`Label-${status}`) });
      const expected = getStepperIndicatorGlyph(variant, status);
      if (variant === "ascii" && status === "active") {
        // The blinking cursor is rendered as `[` + `~` + `]` across nested
        // spans — text content normalises to "[~]" without spaces.
        expect(trigger).toHaveTextContent("[~]");
      } else {
        expect(trigger).toHaveTextContent(expected);
      }
    }
  });

  it("uses numbered variant glyphs for completed/error/skipped/disabled", () => {
    render(
      <Stepper variant="numbered">
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="error">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="skipped">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s4" status="disabled">
          <Stepper.Trigger>Step 4</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveTextContent("✓");
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveTextContent("!");
    expect(screen.getByRole("button", { name: /Step 3/ })).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: /Step 4/ })).toHaveTextContent("·");
  });

  it("writes data-variant on the root list and data-status on each step", () => {
    render(
      <Stepper variant="bullet">
        <Stepper.Step stepId="s1" status="skipped">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );
    const list = screen.getByRole("list", { name: /Progress steps/ });
    expect(list).toHaveAttribute("data-variant", "bullet");
    const step = screen.getByRole("listitem");
    expect(step).toHaveAttribute("data-status", "skipped");
  });

  it("getStepperIndicatorGlyph returns the canonical glyph per (variant, status) cell", () => {
    // Spot-check a few cells — full dictionary is exercised above.
    expect(getStepperIndicatorGlyph("ascii", "completed")).toBe("[x]");
    expect(getStepperIndicatorGlyph("ascii", "pending")).toBe("[ ]");
    expect(getStepperIndicatorGlyph("bullet", "active")).toBe("›");
    expect(getStepperIndicatorGlyph("tag", "skipped")).toBe("SKIP");
    expect(getStepperIndicatorGlyph("tag", "disabled")).toBe("OFF");
    expect(getStepperIndicatorGlyph("progress", "completed")).toBe("███");
    expect(getStepperIndicatorGlyph("numbered", "completed")).toBe("✓");
    expect(getStepperIndicatorGlyph("numbered", "skipped")).toBe("—");
  });

  it("STEP_STATUSES exports the canonical six-state ordering", () => {
    expect(STEP_STATUSES).toEqual([
      "pending",
      "active",
      "completed",
      "error",
      "skipped",
      "disabled",
    ] satisfies StepStatus[]);
  });
});

describe("Stepper prefers-reduced-motion", () => {
  // The grid-template-rows transition that animates expand/collapse must be
  // suppressed under prefers-reduced-motion. The active-substep pulse is
  // gated by Tailwind's motion-safe variant. jsdom does not evaluate @media
  // in stylesheets, so Tailwind's compiled declarations are injected
  // unconditionally to simulate matchMedia returning true; getComputedStyle
  // then reports the suppressed transition and absent animation.
  let styleElement: HTMLStyleElement | null = null;

  beforeAll(() => {
    styleElement = document.createElement("style");
    styleElement.dataset.testSource = "tailwind#motion-reduce+motion-safe";
    styleElement.textContent = `
      .motion-reduce\\:transition-none { transition-property: none; }
      .motion-safe\\:animate-pulse { animation: none; }
    `;
    document.head.appendChild(styleElement);
  });

  afterAll(() => {
    styleElement?.remove();
    styleElement = null;
  });

  it("suppresses the grid-row transition on the animated wrapper", () => {
    renderStepper({ defaultExpandedIds: ["s1"] });
    const region = screen.getByRole("region", { name: /Step 1/ });
    expect(getComputedStyle(region).transitionProperty).toBe("none");
  });

  it("applies the active substep pulse only via motion-safe variant", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <Stepper.Substep tag="A" label="Working" status="active" />
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );

    const substep = screen.getByText("Working").parentElement;
    if (!substep) throw new Error("Expected substep label to have a parent element");
    expect(getComputedStyle(substep).animation).toBe("none");
  });
});

function renderStepperInSameOriginIframe(ui: ReactElement) {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentDocument;
  if (!iframeDoc) {
    iframe.remove();
    throw new Error("iframe.contentDocument is null; cannot exercise cross-document stepper");
  }
  const container = iframeDoc.createElement("div");
  iframeDoc.body.appendChild(container);
  const view = render(ui, { container });
  return { iframe, iframeDoc, ...view };
}

describe("Stepper cross-document keyboard navigation", () => {
  it("moves focus with arrow keys inside the trigger ownerDocument", async () => {
    const { iframe, iframeDoc } = renderStepperInSameOriginIframe(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const user = userEvent.setup({ document: iframeDoc });
    const s1 = within(iframeDoc.body).getByRole("button", { name: /Step 1/ });
    const s2 = within(iframeDoc.body).getByRole("button", { name: /Step 2/ });
    s1.focus();
    await user.keyboard("{ArrowDown}");
    expect(s2).toHaveFocus();

    iframe.remove();
  });
});
