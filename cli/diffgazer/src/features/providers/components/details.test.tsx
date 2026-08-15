import type { ProviderListRow } from "@diffgazer/core/providers";
import { CONFORMANCE_TEST_COST_DISCLOSURE } from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import {
  buildProviderRows,
  configurationStatus,
  GEMINI_CONFIGURATION,
  unconfiguredRow,
} from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { frameText } from "../../review/testing/frame-text";
import { ProviderDetails } from "./details";

const NOOP_ACTIONS = {
  onSetup: () => {},
  onSelectModel: () => {},
  onDelete: () => {},
  onDispatchAction: () => {},
};

function renderDetails(row: ProviderListRow): string {
  const { lastFrame } = render(
    <CliThemeProvider initialTheme="dark">
      <ProviderDetails row={row} actions={NOOP_ACTIONS} isActive={false} />
    </CliThemeProvider>,
  );
  return frameText(lastFrame());
}

function rowWithStatus(status: Parameters<typeof configurationStatus>[1]): ProviderListRow {
  return requireValue(
    buildProviderRows([configurationStatus(GEMINI_CONFIGURATION, status)])[0],
    `provider row for ${status}`,
  );
}

afterEach(() => {
  cleanup();
});

describe("ProviderDetails", () => {
  test("tells the user what Test readiness costs before they press it", () => {
    const frame = renderDetails(rowWithStatus("conformance-pending"));

    expect(frame).toContain("Test readiness");
    expect(frame).toContain(CONFORMANCE_TEST_COST_DISCLOSURE.replace(/\s+/g, " "));
  });

  test("repeats the cost disclosure when a failed check invites a re-test", () => {
    const frame = renderDetails(rowWithStatus("conformance-failed"));

    expect(frame).toContain(CONFORMANCE_TEST_COST_DISCLOSURE.replace(/\s+/g, " "));
  });

  test("offers the create action once on an unconfigured row", () => {
    const frame = renderDetails(unconfiguredRow("gemini"));

    expect(frame.match(/Create configuration/g)).toHaveLength(1);
  });

  test("says nothing to remediate on a ready provider", () => {
    const frame = renderDetails(rowWithStatus("ready"));

    expect(frame).not.toContain("No remediation is required.");
    expect(frame).not.toContain(CONFORMANCE_TEST_COST_DISCLOSURE.replace(/\s+/g, " "));
  });
});
