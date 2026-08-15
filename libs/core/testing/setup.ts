import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without `globals`, so React Testing Library cannot register its
// own teardown; without this every rendered hook root stays mounted for the
// worker's lifetime.
afterEach(() => {
  cleanup();
});
