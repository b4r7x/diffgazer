import { useState } from "react";
import type { ReactElement } from "react";
import { Box, useInput } from "ink";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";
import { useTheme } from "../../theme/theme-context.js";
import { useNavigation } from "../navigation-context.js";
import { Panel } from "../../components/ui/panel.js";
import { SectionHeader } from "../../components/ui/section-header.js";
import { TimelineList } from "../../features/history/components/timeline-list.js";
import { HistoryInsightsPane } from "../../features/history/components/history-insights-pane.js";

type Zone = "timeline" | "insights";

const MOCK_REVIEWS = [
  {
    id: "rev-1",
    date: "2026-03-24",
    issueCount: 7,
    severities: [
      { severity: "high", count: 2 },
      { severity: "medium", count: 3 },
      { severity: "low", count: 2 },
    ],
    duration: 14,
    mode: "staged",
  },
  {
    id: "rev-2",
    date: "2026-03-22",
    issueCount: 3,
    severities: [
      { severity: "medium", count: 1 },
      { severity: "low", count: 2 },
    ],
    duration: 8,
    mode: "unstaged",
  },
  {
    id: "rev-3",
    date: "2026-03-20",
    issueCount: 12,
    severities: [
      { severity: "critical", count: 1 },
      { severity: "high", count: 4 },
      { severity: "medium", count: 5 },
      { severity: "low", count: 2 },
    ],
    duration: 22,
    mode: "staged",
  },
  {
    id: "rev-4",
    date: "2026-03-18",
    issueCount: 1,
    severities: [{ severity: "low", count: 1 }],
    duration: 5,
    mode: "unstaged",
  },
];

export function HistoryScreen(): ReactElement {
  useScope("history");
  usePageFooter({
    shortcuts: [
      { key: "Esc", label: "Back" },
      { key: "Tab", label: "Switch pane" },
      { key: "Enter", label: "Open review" },
    ],
  });
  useBackHandler();

  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();
  const { navigate } = useNavigation();

  const [selectedReviewId, setSelectedReviewId] = useState<string | undefined>(undefined);
  const [activeZone, setActiveZone] = useState<Zone>("timeline");

  useInput((_input, key) => {
    if (key.tab) {
      setActiveZone((z) => (z === "timeline" ? "insights" : "timeline"));
    }
  });

  function handleSelect(id: string) {
    setSelectedReviewId(id);
    navigate({ screen: "review", reviewId: id });
  }

  function handleHighlightChange(id: string) {
    setSelectedReviewId(id);
  }

  const selectedReview = MOCK_REVIEWS.find((r) => r.id === selectedReviewId);
  const listWidth = Math.max(Math.floor(columns * 0.4), 30);

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Review History</SectionHeader>
          <Box flexDirection="row">
            <Box
              width={listWidth}
              borderStyle="single"
              borderColor={activeZone === "timeline" ? tokens.accent : tokens.border}
            >
              <TimelineList
                reviews={MOCK_REVIEWS}
                selectedId={selectedReviewId}
                onSelect={handleSelect}
                onHighlightChange={handleHighlightChange}
                isActive={activeZone === "timeline"}
              />
            </Box>
            <Box
              flexGrow={1}
              borderStyle="single"
              borderColor={activeZone === "insights" ? tokens.accent : tokens.border}
            >
              <HistoryInsightsPane review={selectedReview} />
            </Box>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
