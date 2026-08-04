import { toIssueDetailsPresentation } from "@diffgazer/core/review";
import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider, useFocusZone, useScope } from "@diffgazer/keys";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FixPlanChecklist } from "../components/fix-plan-checklist";
import { useReviewDetailsTabKeyboard } from "./use-details-tab-keyboard";

const DETAILS_KEYBOARD_SCOPE = "issue-details-keyboard-test";

function DetailsKeyboardHarness({
  enabled,
  onScroll,
  onToggleStep,
}: {
  enabled: boolean;
  onScroll: (delta: number) => void;
  onToggleStep: (stepIndex: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScope(DETAILS_KEYBOARD_SCOPE);
  useReviewDetailsTabKeyboard({
    scope: DETAILS_KEYBOARD_SCOPE,
    enabled,
    selectedIssue: makeIssue({
      fixPlan: [{ step: 1, action: "Apply the fix" }],
    }),
    activeTab: "details",
    detailsScrollRef: scrollRef,
    moveTab: () => "no-change",
    scrollDetails: onScroll,
    setActiveTab: () => undefined,
    enterList: () => undefined,
    onToggleStep,
  });

  return null;
}

type HarnessZone = "list" | "details";

/**
 * Mirrors the production wiring from use-results-keyboard: a two-zone focus
 * zone whose details target is the real ScrollArea the pane renders (same
 * aria-label and tabIndex={-1}) containing the checklist, with inactive tab
 * content hidden like TabsContent does.
 */
function FixPlanFocusHarness({
  onToggleStep,
  onZoneChange,
}: {
  onToggleStep: (stepIndex: number) => void;
  onZoneChange: (zone: HarnessZone) => void;
}) {
  const [issue] = useState(() =>
    makeIssue({
      fixPlan: [
        { step: 1, action: "Validate input" },
        { step: 2, action: "Add regression test" },
        { step: 3, action: "Document behavior" },
      ],
    }),
  );
  const [zone, setZone] = useState<HarnessZone>("details");
  const [activeTab, setActiveTab] = useState<IssueTab>("details");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLButtonElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useFocusZone<HarnessZone>({
    initial: "details",
    zones: ["list", "details"],
    zone,
    onZoneChange: (next) => {
      onZoneChange(next);
      setZone(next);
    },
    scope: DETAILS_KEYBOARD_SCOPE,
    focus: {
      autoFocus: true,
      targets: {
        list: listRef,
        details: { container: paneRef, target: scrollRef },
      },
    },
  });

  const handleToggleStep = (stepIndex: number) => {
    onToggleStep(stepIndex);
    setCompletedSteps((previous) => {
      const next = new Set(previous);
      if (next.has(stepIndex)) next.delete(stepIndex);
      else next.add(stepIndex);
      return next;
    });
  };

  const { focusedStepIndex, setFocusedStepIndex } = useReviewDetailsTabKeyboard({
    scope: DETAILS_KEYBOARD_SCOPE,
    enabled: zone === "details",
    selectedIssue: issue,
    activeTab,
    detailsScrollRef: scrollRef,
    moveTab: () => "no-change",
    scrollDetails: () => undefined,
    setActiveTab,
    enterList: () => setZone("list"),
    onToggleStep: handleToggleStep,
  });

  return (
    <>
      <button type="button" ref={listRef}>
        issue list
      </button>
      <div ref={paneRef}>
        <ScrollArea
          ref={scrollRef}
          aria-label="Issue details"
          keyboardScrollable={false}
          tabIndex={-1}
        >
          <div hidden={activeTab !== "details"}>
            <FixPlanChecklist
              steps={toIssueDetailsPresentation(issue).fixPlan}
              completedSteps={completedSteps}
              onToggle={handleToggleStep}
              focusedStepIndex={focusedStepIndex}
              onFocusedIndexChange={setFocusedStepIndex}
            />
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function dispatchCancelableKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  // fireEvent retained: direct dispatch exposes defaultPrevented on the exact cancelable event.
  fireEvent(window, event);
  return event;
}

describe("useReviewDetailsTabKeyboard", () => {
  it("prevents native scrolling and toggling defaults only while details bindings are active", () => {
    const onScroll = vi.fn();
    const onToggleStep = vi.fn();
    const { rerender } = render(
      <KeyboardProvider>
        <DetailsKeyboardHarness enabled onScroll={onScroll} onToggleStep={onToggleStep} />
      </KeyboardProvider>,
    );

    const arrowDown = dispatchCancelableKey("ArrowDown");
    const space = dispatchCancelableKey(" ");

    expect(arrowDown.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    expect(onScroll).toHaveBeenCalledOnce();
    expect(onScroll).toHaveBeenCalledWith(80);
    expect(onToggleStep).toHaveBeenCalledOnce();
    expect(onToggleStep).toHaveBeenCalledWith(0);

    rerender(
      <KeyboardProvider>
        <DetailsKeyboardHarness enabled={false} onScroll={onScroll} onToggleStep={onToggleStep} />
      </KeyboardProvider>,
    );

    const nativeArrowDown = dispatchCancelableKey("ArrowDown");
    const nativeSpace = dispatchCancelableKey(" ");

    expect(nativeArrowDown.defaultPrevented).toBe(false);
    expect(nativeSpace.defaultPrevented).toBe(false);
    expect(onScroll).toHaveBeenCalledOnce();
    expect(onToggleStep).toHaveBeenCalledOnce();
  });
});

describe("fix-plan checklist focus custody", () => {
  function renderHarness() {
    const onToggleStep = vi.fn();
    const onZoneChange = vi.fn();
    render(
      <KeyboardProvider>
        <FixPlanFocusHarness onToggleStep={onToggleStep} onZoneChange={onZoneChange} />
      </KeyboardProvider>,
    );
    return { onToggleStep, onZoneChange };
  }

  function step(name: RegExp): HTMLElement {
    return screen.getByRole("checkbox", { name });
  }

  it("moves DOM focus through the checklist with j/k without leaving the details zone", async () => {
    const user = userEvent.setup();
    const { onZoneChange } = renderHarness();

    expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus();

    await user.keyboard("j");
    expect(step(/2\. Add regression test/)).toHaveFocus();
    expect(step(/2\. Add regression test/)).toHaveAttribute("data-highlighted");

    await user.keyboard("j");
    expect(step(/3\. Document behavior/)).toHaveFocus();

    await user.keyboard("j");
    expect(step(/3\. Document behavior/)).toHaveFocus();

    await user.keyboard("k");
    await user.keyboard("k");
    expect(step(/1\. Validate input/)).toHaveFocus();
    expect(step(/1\. Validate input/)).toHaveAttribute("data-highlighted");

    expect(onZoneChange).not.toHaveBeenCalled();
  });

  it("toggles the step that owns DOM focus with Space and Enter, keeping focus on it", async () => {
    const user = userEvent.setup();
    const { onToggleStep, onZoneChange } = renderHarness();

    await user.keyboard("j");
    const focusedStep = step(/2\. Add regression test/);
    expect(focusedStep).toHaveFocus();

    await user.keyboard(" ");
    expect(onToggleStep).toHaveBeenCalledTimes(1);
    expect(onToggleStep).toHaveBeenCalledWith(1);
    expect(focusedStep).toBeChecked();
    expect(focusedStep).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onToggleStep).toHaveBeenCalledTimes(2);
    expect(focusedStep).not.toBeChecked();
    expect(focusedStep).toHaveFocus();

    expect(onZoneChange).not.toHaveBeenCalled();
  });

  it("parks focus on the details scroll body when a tab switch hides the checklist", async () => {
    const user = userEvent.setup();
    const { onZoneChange } = renderHarness();

    await user.keyboard("j");
    expect(step(/2\. Add regression test/)).toHaveFocus();

    await user.keyboard("2");
    expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus();
    expect(onZoneChange).not.toHaveBeenCalled();

    await user.keyboard("1");
    await user.keyboard("j");
    expect(step(/3\. Document behavior/)).toHaveFocus();
  });
});
