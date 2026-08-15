import { Box, Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { frameForegrounds } from "./frame-colors";

afterEach(() => {
  cleanup();
});

describe("TUI frame colour", () => {
  test("renders a row as plain text whatever colour the operator's terminal forces", () => {
    // chalk resolves colour support once, when ink first imports it, so the
    // suite has to pin it before any test file loads ink.
    expect(process.env.FORCE_COLOR).toBe("0");

    const { lastFrame } = render(
      <Box gap={1}>
        <Text color="#ff0000">[ ]</Text>
        <Text color="#00ff00">1.</Text>
        <Text color="#0000ff">First fix step</Text>
      </Box>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("[ ] 1. First fix step");
    expect(frameForegrounds(frame)).toEqual([]);
  });
});
