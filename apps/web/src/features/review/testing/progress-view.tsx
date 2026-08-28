import { FooterProvider } from "@diffgazer/core/footer";
import type { ReviewEvent } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { KeyboardProvider } from "@diffgazer/keys";
import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import { FooterView } from "@/testing/footer-view";
import {
  type ReviewProgressData,
  ReviewProgressView,
  type ReviewProgressViewProps,
} from "../components/progress-view";

export function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: "guardian",
    meta: {
      id: "guardian",
      lens: "security",
      name: "Guardian",
      badgeLabel: "SEC",
      badgeVariant: "warning",
      description: "",
    },
    status: "running",
    progress: 40,
    issueCount: 0,
    ...overrides,
  };
}

export function makeProgressData(overrides: Partial<ReviewProgressData> = {}): ReviewProgressData {
  return {
    steps: [{ id: "parse", label: "Parse diff", status: "completed" }],
    events: [],
    agents: [],
    metrics: {
      filesProcessed: 0,
      filesTotal: 0,
      issuesFound: 0,
    },
    notices: [],
    ...overrides,
  };
}

export type ThinkingAgent = Extract<ReviewEvent, { type: "agent_thinking" }>["agent"];

export function makeLogEvent(index: number, agent: ThinkingAgent = "detective"): ReviewEvent {
  return {
    type: "agent_thinking",
    agent,
    thought: `event-${index}`,
    timestamp: "2026-01-01T00:00:00.000Z",
  };
}

export function makeLogEvents(count: number, agent: ThinkingAgent = "detective"): ReviewEvent[] {
  return Array.from({ length: count }, (_, index) => makeLogEvent(index, agent));
}

export function renderView(
  props: Partial<ReviewProgressViewProps> = {},
  options?: RenderOptions,
): RenderResult {
  return render(
    <KeyboardProvider>
      <FooterProvider>
        <ReviewProgressView
          data={props.data ?? makeProgressData()}
          isRunning={props.isRunning ?? false}
          error={props.error}
          errorCode={props.errorCode}
          transportFamily={props.transportFamily}
          reviewId={props.reviewId}
          contextRefreshError={props.contextRefreshError}
          onRetryContextRefresh={props.onRetryContextRefresh}
          onRetry={props.onRetry}
          onViewResults={props.onViewResults}
          onCancel={props.onCancel}
          onBack={props.onBack}
          cancelDisabled={props.cancelDisabled}
        />
        <FooterView />
      </FooterProvider>
    </KeyboardProvider>,
    options,
  );
}
