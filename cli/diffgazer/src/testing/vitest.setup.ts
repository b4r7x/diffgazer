import stripAnsi from "strip-ansi";
import { expect } from "vitest";

expect.addSnapshotSerializer({
  test: (value) => typeof value === "string" && stripAnsi(value) !== value,
  print: (value) => JSON.stringify(stripAnsi(String(value))),
});
