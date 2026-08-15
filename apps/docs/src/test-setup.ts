import "@testing-library/jest-dom/vitest";
import "@diffgazer/core/testing/dom-polyfills";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library's own 1s async budget is independent of the vitest testTimeout this
// workspace already widened for `turbo run test` fan-out. Role queries over the full docs
// shell (sidebar, pager, TOC) are expensive enough that a starved worker can spend the
// whole default window on a couple of polls, failing a `findBy*` for an element that does
// arrive. Elements still have to appear — this only widens how long we wait for them.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});
