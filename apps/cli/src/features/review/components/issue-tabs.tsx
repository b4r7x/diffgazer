import type { ReactElement } from "react";
import { Box, Text } from "ink";

export type IssueTab = "details" | "explain" | "trace" | "patch";

const TAB_LABELS: Record<IssueTab, string> = {
  details: "Details",
  explain: "Explain",
  trace: "Trace",
  patch: "Patch",
};

const TAB_KEYS: Record<IssueTab, string> = {
  details: "1",
  explain: "2",
  trace: "3",
  patch: "4",
};

export const TAB_ORDER = ["details", "explain", "trace", "patch"] as const;

interface IssueTabsProps {
  activeTab: IssueTab;
  hasPatch: boolean;
  hasTrace: boolean;
}

export function IssueTabs({
  activeTab,
  hasPatch,
  hasTrace,
}: IssueTabsProps): ReactElement {
  return (
    <Box flexDirection="row" gap={1} marginBottom={1}>
      {TAB_ORDER.map((tab) => {
        const isActive = tab === activeTab;
        const isDisabled =
          (tab === "patch" && !hasPatch) || (tab === "trace" && !hasTrace);

        if (isDisabled) {
          return (
            <Box key={tab}>
              <Text dimColor>
                [{TAB_KEYS[tab]}] {TAB_LABELS[tab]}
              </Text>
            </Box>
          );
        }

        return (
          <Box key={tab}>
            <Text
              color={isActive ? "cyan" : undefined}
              bold={isActive}
              underline={isActive}
            >
              [{TAB_KEYS[tab]}] {TAB_LABELS[tab]}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export { TAB_KEYS };
