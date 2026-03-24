import { Box } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { Panel } from "../../../components/ui/panel.js";
import { Badge } from "../../../components/ui/badge.js";
import { InfoField } from "./info-field.js";

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
  const { tokens } = useTheme();

  return (
    <Panel>
      <Panel.Header variant="subtle">Context</Panel.Header>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <InfoField label="Provider:" value={providerName ?? "Not configured"} />
          <InfoField label="Model:" value={modelName ?? "Not selected"} />
          <InfoField
            label="Last Review:"
            value={
              lastReviewDate
                ? lastReviewIssues !== undefined
                  ? `${lastReviewDate} (${lastReviewIssues} issues)`
                  : lastReviewDate
                : "None"
            }
          />
          <InfoField
            label="Trust:"
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
