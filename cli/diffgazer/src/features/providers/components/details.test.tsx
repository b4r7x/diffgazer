import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  getProviderActionLayout,
  getUnrecognizedConfigurationActionLayout,
} from "@diffgazer/core/providers";
import { CONFORMANCE_TEST_COST_DISCLOSURE } from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import {
  buildProviderRows,
  configurationStatus,
  configuredRow,
  GEMINI_CONFIGURATION,
  OPENCODE_GO_CONFIGURATION,
  unconfiguredRow,
} from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { frameText } from "../../review/testing/frame-text";
import { ProviderDetails } from "./details";

function renderDetails(
  row: ProviderListRow,
  { compact = false, activeConfigurationId = null as string | null } = {},
): string {
  const { lastFrame } = render(
    <CliThemeProvider initialTheme="dark">
      <ProviderDetails
        row={row}
        layout={getProviderActionLayout(row, activeConfigurationId)}
        onAction={() => {}}
        isActive={false}
        compact={compact}
      />
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
  test("tells the user what Verify costs before they press it", () => {
    const frame = renderDetails(rowWithStatus("conformance-pending"));

    expect(frame).toContain("[ Select configuration ]");
    expect(frame).toContain("[ Change model ]");
    expect(frame).toContain("[ More ]");
    expect(frame).toContain("Not verified");
    expect(frame).toContain(CONFORMANCE_TEST_COST_DISCLOSURE.replace(/\s+/g, " "));
  });

  test("keeps the row to a primary, one secondary and More, with everything else behind More", () => {
    const frame = renderDetails(rowWithStatus("ready"));

    expect(frame).toContain("[ Select configuration ]");
    expect(frame).toContain("[ Change model ]");
    expect(frame).toContain("[ More ]");
    expect(frame).not.toContain("Update configuration");
    expect(frame).not.toContain("Delete configuration");
    expect(frame.match(/\[ Verify \]/g)).toBeNull();
  });

  test("says why a dimmed primary cannot run", () => {
    const row = rowWithStatus("ready");
    const frame = renderDetails({ ...row, actions: ["inspect", "test", "update", "delete"] });

    expect(frame).toContain("[ Select configuration ]");
    expect(frame).toContain("Selection is not available");
  });

  test("swaps the primary for an Active chip on the configuration reviews run with", () => {
    const frame = renderDetails(rowWithStatus("ready"), {
      activeConfigurationId: "gemini-primary",
    });

    expect(frame).toContain("[● Active]");
    expect(frame).not.toContain("Select configuration");
    expect(frame).toContain("[ Change model ]");
    expect(frame).toContain("[ More ]");
  });

  test("leads a keyed configuration without a model with Select model beside Update configuration", () => {
    const frame = renderDetails(rowWithStatus("model-missing"));

    expect(frame).toContain("[ Select model ]");
    expect(frame).toContain("[ Update configuration ]");
    expect(frame).toContain("[ More ]");
  });

  test("offers a record this build cannot decode removal alone, behind More", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ProviderDetails
          unrecognized={{ configurationId: "cfg-retired" }}
          layout={getUnrecognizedConfigurationActionLayout()}
          onAction={() => {}}
        />
      </CliThemeProvider>,
    );
    const frame = frameText(lastFrame());

    expect(frame).toContain("cfg-retired");
    expect(frame).toContain("[ More ]");
    expect(frame).not.toContain("Delete configuration");
    expect(frame).not.toContain("Select model");
  });

  test("repeats the cost disclosure when a failed check invites a re-test", () => {
    const frame = renderDetails(rowWithStatus("conformance-failed"));

    expect(frame).toContain(CONFORMANCE_TEST_COST_DISCLOSURE.replace(/\s+/g, " "));
  });

  test("leads an unconfigured row with Configure alone beside More", () => {
    const frame = renderDetails(unconfiguredRow("gemini"));

    expect(frame.match(/\[ Configure \]/g)).toHaveLength(1);
    expect(frame).toContain("[ More ]");
    expect(frame).not.toContain("Update configuration");
  });

  test("shows the product's billing notice under the billing row", () => {
    const row = rowWithStatus("ready");
    const frame = renderDetails(row);

    expect(frame).toContain("Billing");
    for (const line of row.product.notice.billing) {
      expect(frame).toContain(line.replace(/\s+/g, " "));
    }
  });

  test("drops the billing notice when the pane is too short for it", () => {
    const row = rowWithStatus("ready");
    const frame = renderDetails(row, { compact: true });

    expect(frame).toContain("Billing");
    for (const line of row.product.notice.billing) {
      expect(frame).not.toContain(line.replace(/\s+/g, " "));
    }
  });

  test("states a bound pool once: the name says it, the endpoint row gives the URL", () => {
    const frame = renderDetails(configuredRow(OPENCODE_GO_CONFIGURATION));

    expect(frame).toContain("Name : OpenCode Go");
    expect(frame).toContain("Endpoint : https://opencode.ai/zen/go/v1");
    // The pane used to read "OpenCode Go" as the name, the endpoint value and
    // its description — one thing said three times.
    expect(frame).not.toContain("Endpoint : OpenCode Go");
  });

  test("says nothing about an endpoint before a configuration is bound", () => {
    expect(renderDetails(unconfiguredRow("opencode-zen"))).not.toContain("Endpoint :");
  });

  test("says nothing to remediate on a ready provider", () => {
    const frame = renderDetails(rowWithStatus("ready"));

    expect(frame).toContain("Verified ");
    expect(frame).not.toContain("No remediation is required.");
    expect(frame).not.toContain(CONFORMANCE_TEST_COST_DISCLOSURE.replace(/\s+/g, " "));
  });
});
