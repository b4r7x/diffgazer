import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider, useScope } from "@diffgazer/keys";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReviewDetailsTabKeyboard } from "./use-details-tab-keyboard";

const DETAILS_KEYBOARD_SCOPE = "issue-details-keyboard-test";

function DetailsKeyboardHarness({
  enabled,
  onScroll,
  onToggleStep,
}: {
  enabled: boolean;
  onScroll: (delta: number) => void;
  onToggleStep: (step: number) => void;
}) {
  useScope(DETAILS_KEYBOARD_SCOPE);
  useReviewDetailsTabKeyboard({
    scope: DETAILS_KEYBOARD_SCOPE,
    enabled,
    selectedIssue: makeIssue({
      fixPlan: [{ step: 1, action: "Apply the fix" }],
    }),
    activeTab: "details",
    moveTab: () => "no-change",
    scrollDetails: onScroll,
    setActiveTab: () => undefined,
    enterList: () => undefined,
    onToggleStep,
  });

  return null;
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
    expect(onToggleStep).toHaveBeenCalledWith(1);

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
