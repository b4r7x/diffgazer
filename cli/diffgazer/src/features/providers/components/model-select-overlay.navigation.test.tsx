import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ModelSelectOverlay } from "./model-select-overlay";
import {
  ARROW_DOWN,
  ARROW_UP,
  flush,
  flushUntil,
  geminiName,
  Wrapper,
  countPrefixes,
} from "./model-select-overlay.test-harness";

describe("ModelSelectOverlay ArrowUp after the tier filter shrinks the list", () => {
  afterEach(() => {
    cleanup();
  });

  test("after the filter shrinks the list, ArrowUp from the clamped last item moves the highlight one item back instead of sticking on the last item", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-3-flash-preview")) ?? false);

    const initialFrame = lastFrame();
    expect(
      initialFrame?.includes(geminiName("gemini-3-flash-preview")),
      "initial frame should list gemini models",
    ).toBeTruthy();

    // Move highlight to the LAST item in the full (5-item) list.
    for (let i = 0; i < 4; i += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    const lastModelName = geminiName("gemini-3-pro-preview");
    const afterDown = countPrefixes(lastFrame(), lastModelName);
    expect(
      afterDown.highlighted,
      `after 4 ArrowDown presses, the last gemini model should be highlighted. Frame: ${lastFrame()}`,
    ).toBe(1);

    // Shrink the filter to "paid" : 2 of the 5 models. With this free-first data:
    //   free: 2.5-flash, 2.5-flash-lite, 2.5-pro
    //   paid: 3-flash-preview, 3-pro-preview
    // "f" cycles all -> free -> paid, so two presses land on "paid".
    stdin.write("f");
    await flush();
    stdin.write("f");
    await flush();

    // Sanity: only the 2 paid models are visible now.
    const paidFirst = geminiName("gemini-3-flash-preview");
    const paidSecond = geminiName("gemini-3-pro-preview");
    const freeAny = geminiName("gemini-2.5-flash");
    const shrunkenFrame = lastFrame();
    expect(
      shrunkenFrame?.includes(paidFirst) && shrunkenFrame?.includes(paidSecond),
      "after switching tier filter to 'paid', both paid models should be visible",
    ).toBeTruthy();
    expect(
      !shrunkenFrame?.includes(freeAny),
      "after switching tier filter to 'paid', free models should not be visible",
    ).toBeTruthy();

    // The highlight had moved past the shrunken list, so it lands clamped on
    // the last visible (second paid) model.
    const beforeArrowUp = countPrefixes(lastFrame(), paidSecond);
    expect(
      beforeArrowUp.highlighted,
      "before ArrowUp, the last visible paid model should be highlighted",
    ).toBe(1);

    // ArrowUp must step back one item rather than staying on the last item.
    stdin.write(ARROW_UP);
    await flush();

    const afterArrowUpFirst = countPrefixes(lastFrame(), paidFirst);
    const afterArrowUpSecond = countPrefixes(lastFrame(), paidSecond);

    expect(
      afterArrowUpFirst.highlighted,
      `after ArrowUp, the first paid model should be highlighted. Frame: ${lastFrame()}`,
    ).toBe(1);
    expect(
      afterArrowUpSecond.highlighted,
      "after ArrowUp, the second paid model should no longer be highlighted",
    ).toBe(0);
  });
});

describe("ModelSelectOverlay search input mode", () => {
  afterEach(() => {
    cleanup();
  });

  test("typing q in model search does not trigger the global quit shortcut", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    stdin.write("/");
    await flush();
    stdin.write("q");
    await flush();

    expect(lastFrame()).toContain("q");
    expect(lastFrame()).not.toContain("Search models...");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("a multi-character paste into the model search field lands in full", async () => {
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    stdin.write("/");
    await flush();
    stdin.write("flash");
    await flush();

    expect(lastFrame()).toContain("flash");
  });

  test("Escape clears a populated search before closing the dialog", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("/");
    await flush();
    stdin.write("pro");
    await flush();
    expect(lastFrame()).toContain("pro");

    stdin.write("\u001B");
    await flushUntil(() => lastFrame()?.includes("Search models...") ?? false);

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("Search models...");
    expect(onOpenChange).not.toHaveBeenCalled();

    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("one Escape closes from the filter zone", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay
          open={true}
          onOpenChange={onOpenChange}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    expect(lastFrame()).toContain("<-/->");
    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
