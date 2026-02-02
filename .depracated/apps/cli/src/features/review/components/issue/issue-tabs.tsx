import type { ReactElement } from "react";
import { Box, Text } from "ink";
import {
  type IssueTab,
  TAB_ORDER,
  TAB_LABELS,
  TAB_KEYS,
} from "../../constants.js";

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
