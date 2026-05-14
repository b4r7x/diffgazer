import assert from "node:assert/strict";
import test, { describe, afterEach } from "node:test";
import type { ReactNode } from "react";
import { render, cleanup } from "ink-testing-library";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { createApi, type BoundApi } from "@diffgazer/core/api";
import { GEMINI_MODEL_INFO } from "@diffgazer/core/schemas/config";
import { CliThemeProvider } from "../../../theme/theme-context.js";
import { ModelSelectOverlay } from "./model-select-overlay.js";

const ARROW_UP = "[A";
const ARROW_DOWN = "[B";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = makeQueryClient();
  const api = createApi({ baseUrl: "http://localhost" }) satisfies BoundApi;
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme="dark">{children}</CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function countPrefixes(frame: string | undefined, name: string): {
  highlighted: number;
  unhighlighted: number;
} {
  if (!frame) return { highlighted: 0, unhighlighted: 0 };
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const highlightedMatches = frame.match(new RegExp(`>\\s+\\[\\s\\]\\s+${escaped}`, "g")) ?? [];
  const unhighlightedMatches = frame.match(new RegExp(`(?<!>)\\s\\s+\\[\\s\\]\\s+${escaped}`, "g")) ?? [];
  return {
    highlighted: highlightedMatches.length,
    unhighlighted: unhighlightedMatches.length,
  };
}

describe("ModelSelectOverlay ArrowUp after list shrinks (W9.5 bug fix)", () => {
  afterEach(() => {
    cleanup();
  });

  test("rebases ArrowUp on safeHighlightIndex so the highlight moves one step backward in the shrunken list, not stays on the last visible item", async () => {
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

    await flush();

    const initialFrame = lastFrame();
    assert.ok(
      initialFrame?.includes(GEMINI_MODEL_INFO["gemini-3-flash-preview"].name),
      "initial frame should list gemini models",
    );

    // Move highlight to the LAST item in the full (5-item) list.
    for (let i = 0; i < 4; i += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    const lastModelName = GEMINI_MODEL_INFO["gemini-2.5-pro"].name;
    const afterDown = countPrefixes(lastFrame(), lastModelName);
    assert.equal(
      afterDown.highlighted,
      1,
      `after 4 ArrowDown presses, the last gemini model should be highlighted. Frame: ${lastFrame()}`,
    );

    // Shrink the filter to "paid" — 2 models out of 5. With Gemini static data:
    //   free: 2.5-flash, 2.5-flash-lite, 2.5-pro
    //   paid: 3-flash-preview, 3-pro-preview
    // "f" cycles all -> free -> paid. Two presses get us to "paid".
    stdin.write("f");
    await flush();
    stdin.write("f");
    await flush();

    // Sanity: only the 2 paid models are visible now.
    const paidFirst = GEMINI_MODEL_INFO["gemini-3-flash-preview"].name;
    const paidSecond = GEMINI_MODEL_INFO["gemini-3-pro-preview"].name;
    const freeAny = GEMINI_MODEL_INFO["gemini-2.5-flash"].name;
    const shrunkenFrame = lastFrame();
    assert.ok(
      shrunkenFrame?.includes(paidFirst) && shrunkenFrame?.includes(paidSecond),
      "after switching tier filter to 'paid', both paid models should be visible",
    );
    assert.ok(
      !shrunkenFrame?.includes(freeAny),
      "after switching tier filter to 'paid', free models should not be visible",
    );

    // Before pressing ArrowUp: highlightIndex is still 4 (stale), but
    // safeHighlightIndex clamps to min(4, 1) = 1, so the second paid model
    // is highlighted.
    const beforeArrowUp = countPrefixes(lastFrame(), paidSecond);
    assert.equal(
      beforeArrowUp.highlighted,
      1,
      "before ArrowUp, the clamped (safeHighlightIndex=1) item should be highlighted",
    );

    // The bug being fixed by Wave 9 slot 05:
    //   Pre-fix:  setHighlightIndex((prev - 1 + len) % len) with stale prev=4
    //             → (4 - 1 + 2) % 2 = 1, highlight stays on paidSecond.
    //   Post-fix: setHighlightIndex((safeHighlightIndex - 1 + len) % len)
    //             with safeHighlightIndex=1 → (1 - 1 + 2) % 2 = 0,
    //             highlight moves to paidFirst.
    stdin.write(ARROW_UP);
    await flush();

    const afterArrowUpFirst = countPrefixes(lastFrame(), paidFirst);
    const afterArrowUpSecond = countPrefixes(lastFrame(), paidSecond);

    assert.equal(
      afterArrowUpFirst.highlighted,
      1,
      `after ArrowUp from clamped index 1, the FIRST paid model should be highlighted. Frame: ${lastFrame()}`,
    );
    assert.equal(
      afterArrowUpSecond.highlighted,
      0,
      "after ArrowUp from clamped index 1, the second paid model should no longer be highlighted",
    );
  });
});
