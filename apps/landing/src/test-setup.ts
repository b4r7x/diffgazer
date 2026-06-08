/// <reference types="@chialab/vitest-axe/matchers" />
import "@testing-library/jest-dom/vitest";
import matchers from "@chialab/vitest-axe";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
