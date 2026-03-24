import { useState } from "react";
import type { ReactElement } from "react";
import { Box } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import { KeyValue } from "../../../components/ui/key-value.js";

export function DiagnosticsScreen(): ReactElement {
  useScope("settings-diagnostics");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Refresh" }] });
  useBackHandler();

  const [refreshCount, setRefreshCount] = useState(0);

  // Static values — a real implementation would shell out or call an API
  const serverStatus = "running";
  const gitVersion = process.env.GIT_VERSION ?? "2.x";
  const nodeVersion = process.version;

  function handleRefresh() {
    setRefreshCount((c) => c + 1);
  }

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Diagnostics</SectionHeader>
          <KeyValue
            label="Server"
            value={
              <Badge variant={serverStatus === "running" ? "success" : "error"} dot>
                {serverStatus}
              </Badge>
            }
            labelWidth={14}
          />
          <KeyValue label="Git version" value={gitVersion} labelWidth={14} />
          <KeyValue label="Node version" value={nodeVersion} labelWidth={14} />
          <KeyValue label="Refreshes" value={String(refreshCount)} labelWidth={14} />
          <Box gap={1} marginTop={1}>
            <Button variant="secondary" onPress={handleRefresh}>Refresh</Button>
          </Box>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
