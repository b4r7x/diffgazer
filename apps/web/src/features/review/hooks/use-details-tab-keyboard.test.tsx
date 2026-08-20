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
// What core reports for these fixtures: they carry a fix plan but no trace and
// no patch.
const FIXTURE_AVAILABLE_TABS: IssueTab[] = ["details", "explain"];

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
  const issue = makeIssue({ fixPlan: [{ step: 1, action: "Apply the fix" }] });
  useReviewDetailsTabKeyboard({
    scope: DETAILS_KEYBOARD_SCOPE,
    enabled,
    selectedIssue: issue,
    activeTab: "details",
    availableTabs: FIXTURE_AVAILABLE_TABS,
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
  onScroll,
}: {
  onToggleStep: (stepIndex: number) => void;
  onZoneChange: (zone: HarnessZone) => void;
  onScroll: (delta: number) => void;
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
    availableTabs: FIXTURE_AVAILABLE_TABS,
    detailsScrollRef: scrollRef,
    moveTab: () => "no-change",
    scrollDetails: onScroll,
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

/**
 * The patch tab as the pane renders it: the mobile back-to-issues button above
 * the details scroll body, which holds the diff region Enter hands focus to.
 */
function PatchTabHarness({ onBackToList }: { onBackToList: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScope(DETAILS_KEYBOARD_SCOPE);
  useReviewDetailsTabKeyboard({
    scope: DETAILS_KEYBOARD_SCOPE,
    enabled: true,
    selectedIssue: makeIssue({}),
    activeTab: "patch",
    availableTabs: ["details", "patch"],
    detailsScrollRef: scrollRef,
    moveTab: () => "no-change",
    scrollDetails: () => undefined,
    setActiveTab: () => undefined,
    enterList: () => undefined,
    onToggleStep: () => undefined,
  });

  return (
    <>
      <button type="button" onClick={onBackToList}>
        <span aria-hidden="true">←</span> Issues
      </button>
      <ScrollArea
        ref={scrollRef}
        aria-label="Issue details"
        keyboardScrollable={false}
        tabIndex={-1}
      >
        <figure data-slot="diff-view-rows" tabIndex={-1} aria-label="Suggested patch" />
      </ScrollArea>
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
    const onScroll = vi.fn();
    render(
      <KeyboardProvider>
        <FixPlanFocusHarness
          onToggleStep={onToggleStep}
          onZoneChange={onZoneChange}
          onScroll={onScroll}
        />
      </KeyboardProvider>,
    );
    return { onToggleStep, onZoneChange, onScroll };
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

  it("steps checklist focus with vertical arrows only while focus sits inside the checklist", async () => {
    const user = userEvent.setup();
    const { onScroll } = renderHarness();

    // Focus parked on the scroll body: arrows scroll the details pane.
    expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(onScroll).toHaveBeenCalledWith(80);

    await user.keyboard("j");
    expect(step(/2\. Add regression test/)).toHaveFocus();

    // Focus inside the checklist: arrows step like j/k instead of scrolling.
    await user.keyboard("{ArrowDown}");
    expect(step(/3\. Document behavior/)).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");
    expect(step(/1\. Validate input/)).toHaveFocus();

    // The boundary clamps instead of handing the key back to scrolling.
    await user.keyboard("{ArrowUp}");
    expect(step(/1\. Validate input/)).toHaveFocus();
    expect(onScroll).toHaveBeenCalledTimes(1);
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

  it("ignores checklist markers outside the details scroll body when gating arrows", async () => {
    const user = userEvent.setup();
    const onToggleStep = vi.fn();
    const onZoneChange = vi.fn();
    const onScroll = vi.fn();
    render(
      <KeyboardProvider>
        <FixPlanFocusHarness
          onToggleStep={onToggleStep}
          onZoneChange={onZoneChange}
          onScroll={onScroll}
        />
        <div data-checklist="fix-plan">
          <button type="button">decoy step</button>
        </div>
      </KeyboardProvider>,
    );

    const decoy = screen.getByRole("button", { name: "decoy step" });
    await user.click(decoy);
    expect(decoy).toHaveFocus();

    // Arrows from the decoy must not steal focus into the details checklist.
    await user.keyboard("{ArrowDown}");

    expect(onScroll).toHaveBeenCalledWith(80);
    expect(decoy).toHaveFocus();
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

describe("patch-tab Enter custody", () => {
  function renderPatchHarness() {
    const onBackToList = vi.fn();
    render(
      <KeyboardProvider>
        <PatchTabHarness onBackToList={onBackToList} />
      </KeyboardProvider>,
    );
    return { onBackToList };
  }

  it("hands the details zone to the diff region on Enter", async () => {
    const user = userEvent.setup();
    renderPatchHarness();

    screen.getByRole("region", { name: "Issue details" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("figure", { name: "Suggested patch" })).toHaveFocus();
  });

  it("leaves Enter to the back-to-issues button instead of yanking focus into the pane", async () => {
    const user = userEvent.setup();
    const { onBackToList } = renderPatchHarness();

    const backToIssues = screen.getByRole("button", { name: "Issues" });
    backToIssues.focus();
    await user.keyboard("{Enter}");

    expect(onBackToList).toHaveBeenCalledOnce();
    expect(backToIssues).toHaveFocus();
    expect(screen.getByRole("figure", { name: "Suggested patch" })).not.toHaveFocus();
  });
});
