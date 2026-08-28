import type { BoundApi } from "@diffgazer/core/api";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { GitStatus } from "@diffgazer/core/schemas/git";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { makeAllConfigurationsListResponse } from "@diffgazer/core/testing/provider-fixtures";
import { Text } from "ink";
import { render } from "ink-testing-library";
import type { ReactElement } from "react";
import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation";
import { useNavigation } from "../../../hooks/use-navigation";
import type { Route } from "../../../lib/routes";
import { ApiBoundary } from "../../../testing/api-boundary";
import { CliThemeProvider } from "../../../theme/provider";
import { ReviewContainer } from "../components/container";

export const ESC = "\u001b";

const shellList = makeAllConfigurationsListResponse();

const PROJECT = {
  projectId: "project-1",
  path: "/Users/dev/Projects/diffgazer-workspace",
  trust: {
    repoRoot: "/Users/dev/Projects/diffgazer-workspace",
    capabilities: { readFiles: true, runCommands: false },
    projectId: "project-1",
    trustedAt: "2026-01-01T00:00:00.000Z",
    trustMode: "persistent" as const,
  },
};

export function makeReadyInitResponse() {
  return {
    schemaVersion: 2 as const,
    configurations: shellList.configurations,
    selectedConfigurationId: shellList.selectedConfigurationId,
    settings: {
      theme: "dark" as const,
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low" as const,
      secretsStorage: "file" as const,
      agentExecution: "sequential" as const,
      // A finished install: the consent is on record, so a switch starts at once.
      providerConsent: { version: 1 as const, acceptedAt: "2026-08-01T09:00:00.000Z" },
    },
    project: PROJECT,
  };
}

export function makeUnconfiguredInitResponse() {
  return {
    schemaVersion: 2 as const,
    configurations: [],
    selectedConfigurationId: null,
    settings: {
      theme: "dark" as const,
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low" as const,
      secretsStorage: "file" as const,
      agentExecution: "sequential" as const,
      providerConsent: null,
    },
    project: PROJECT,
  };
}

function RouteHarness({
  onViewRunDetails,
}: {
  onViewRunDetails?: (reviewId: string) => void;
}): ReactElement {
  const { route } = useNavigation();

  if (route.screen !== "review") {
    if (route.screen === "home") return <Text>Home route</Text>;
    const intent = route.screen === "settings/providers" && route.intent ? ` ${route.intent}` : "";
    return <Text>{`Route: ${route.screen}${intent}`}</Text>;
  }

  return (
    <ReviewContainer
      mode={route.mode}
      pickFiles={route.pickFiles}
      reviewId={route.reviewId}
      allowResumeWithoutSetup={route.live}
      onViewRunDetails={onViewRunDetails}
    />
  );
}

function FooterProbe(): ReactElement {
  const { shortcuts, rightShortcuts } = useFooterData();
  const left = shortcuts.map((shortcut) => `${shortcut.key} ${shortcut.label}`).join(", ");
  const right = rightShortcuts.map((shortcut) => `${shortcut.key} ${shortcut.label}`).join(", ");

  return <Text>{`Footer left: ${left || "none"} right: ${right || "none"}`}</Text>;
}

export interface RenderReviewContainerOptions {
  /** Members of the bound API the test drives; everything else is the plain client. */
  api?: Partial<BoundApi>;
  initialRoute?: Route;
  initialShortcuts?: Shortcut[];
  showFooterProbe?: boolean;
  onViewRunDetails?: (reviewId: string) => void;
  gitStatus?: GitStatus;
}

export function renderReviewContainer({
  api,
  initialRoute = { screen: "review", reviewId: "review-123", mode: "staged" },
  initialShortcuts = [],
  showFooterProbe = false,
  onViewRunDetails,
  gitStatus,
}: RenderReviewContainerOptions = {}): ReturnType<typeof render> {
  return render(
    <ApiBoundary api={{ ...api, ...(gitStatus ? { getGitStatus: async () => gitStatus } : {}) }}>
      <CliThemeProvider initialTheme="dark">
        <TerminalKeyboardProvider>
          <NavigationProvider initialRoute={initialRoute}>
            <FooterProvider initialShortcuts={initialShortcuts}>
              <RouteHarness onViewRunDetails={onViewRunDetails} />
              {showFooterProbe ? <FooterProbe /> : null}
            </FooterProvider>
          </NavigationProvider>
        </TerminalKeyboardProvider>
      </CliThemeProvider>
    </ApiBoundary>,
  );
}
