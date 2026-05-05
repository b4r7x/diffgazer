import { Box } from "ink";
import { Panel } from "../../../components/ui/panel.js";
import { Badge } from "../../../components/ui/badge.js";
import { KeyValue } from "../../../components/ui/key-value.js";

interface ContextSidebarProps {
  providerName?: string;
  modelName?: string;
  lastReviewDate?: string;
  lastReviewIssues?: number;
  trustStatus?: "trusted" | "untrusted" | "unknown";
}

const trustVariant = {
  trusted: "success",
  unknown: "warning",
  untrusted: "error",
} as const;

export function ContextSidebar({
  providerName,
  modelName,
  lastReviewDate,
  lastReviewIssues,
  trustStatus = "unknown",
}: ContextSidebarProps) {
  return (
    <Panel>
      <Panel.Header variant="subtle">Context</Panel.Header>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <KeyValue label="Provider" value={providerName ?? "Not configured"} />
          <KeyValue label="Model" value={modelName ?? "Not selected"} />
          <KeyValue
            label="Last Review"
            value={
              lastReviewDate
                ? lastReviewIssues !== undefined
                  ? `${lastReviewDate} (${lastReviewIssues} issues)`
                  : lastReviewDate
                : "None"
            }
          />
          <KeyValue
            label="Trust"
            value={
              <Badge variant={trustVariant[trustStatus]} dot>
                {trustStatus}
              </Badge>
            }
          />
        </Box>
      </Panel.Content>
    </Panel>
  );
}
