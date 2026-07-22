import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { AGENT_METADATA, type AgentId, type AgentState } from "@diffgazer/core/schemas/events";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { vi } from "vitest";

import { CliThemeProvider } from "../../../../theme/provider";
import { ReviewProgressView, type ReviewProgressViewProps } from "./view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

export function makeAgent(id: AgentId): AgentState {
  return {
    id,
    meta: AGENT_METADATA[id],
    status: "queued",
    progress: 0,
    issueCount: 0,
    currentAction: "reportqueued",
  };
}

export function FooterProbe() {
  const { shortcuts } = useFooterData();
  return <Text>{shortcuts.map(({ key, label }) => `${key} ${label}`).join(", ")}</Text>;
}

export function makeContextSnapshot(): ReviewContextResponse {
  return {
    text: "context",
    markdown: "# Context",
    graph: {
      generatedAt: "2026-01-01T00:00:00.000Z",
      root: "/repo",
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    },
    meta: {
      generatedAt: "2026-01-01T00:00:00.000Z",
      root: "/repo",
      statusHash: "hash",
      statusHashKind: "full",
      charCount: 7,
    },
  };
}

export async function flush(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

export function renderViewNode(overrides: Partial<ReviewProgressViewProps> = {}) {
  return (
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewProgressView
          progressSteps={[{ id: "parse", label: "Parse diff", status: "completed" }]}
          agents={[]}
          events={[]}
          fileProgress={{ total: 0, current: 0, currentFile: null, completed: [] }}
          isStreaming
          error={null}
          notices={[]}
          issuesFound={0}
          startedAt={null}
          completedAt={null}
          {...overrides}
        />
      </CliThemeProvider>
    </FooterProvider>
  );
}

export function renderView(
  overrides: Partial<ReviewProgressViewProps> = {},
): ReturnType<typeof render> {
  return render(renderViewNode(overrides));
}
