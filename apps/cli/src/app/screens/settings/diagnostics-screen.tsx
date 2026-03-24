import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useInit, useServerStatus, useReviewContext, useRefreshReviewContext } from "@diffgazer/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import { KeyValue } from "../../../components/ui/key-value.js";

function formatTimestamp(value: string | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function DiagnosticsScreen(): ReactElement {
  useScope("settings-diagnostics");
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }, { key: "Enter", label: "Action" }] });
  useBackHandler();

  const { data: initData, isLoading: initLoading, error: initErrorObj } = useInit();
  const initError = initErrorObj?.message ?? null;

  const serverHealth = useServerStatus();
  const reviewContext = useReviewContext();
  const refreshContext = useRefreshReviewContext();

  const isRefreshing = refreshContext.isPending;

  // Server status derived from query state
  const serverStatus = serverHealth.isLoading ? "checking"
    : serverHealth.isSuccess ? "connected"
    : "error";
  const serverError = serverHealth.error?.message ?? null;

  // Context status derived from query state
  const contextStatus = reviewContext.isLoading ? "loading"
    : reviewContext.isSuccess ? "ready"
    : reviewContext.error ? "error"
    : "missing";
  const contextGeneratedAt = reviewContext.data?.meta.generatedAt ?? null;
  const contextError = refreshContext.error?.message ?? reviewContext.error?.message ?? null;

  const handleRegenerateContext = () => {
    refreshContext.mutate({ force: true });
  };

  const handleRefreshAll = () => {
    serverHealth.refetch();
    reviewContext.refetch();
  };

  const nodeVersion = process.version;
  const canRegenerate = contextStatus === "ready" || contextStatus === "missing";

  const serverBadgeVariant = serverStatus === "connected" ? "success"
    : serverStatus === "checking" ? "info"
    : "error";

  const serverLabel = serverStatus === "checking" ? "checking..."
    : serverStatus === "connected" ? "connected"
    : `error: ${serverError ?? "unknown"}`;

  const setupLabel = initLoading ? "loading..."
    : initError ? `error: ${initError}`
    : initData?.setup.isReady ? "ready"
    : `incomplete (${initData?.setup.missing.join(", ") ?? "unknown"})`;

  const setupVariant = initLoading ? "info"
    : initError ? "error"
    : initData?.setup.isReady ? "success"
    : "warning";

  const contextLabel = contextStatus === "loading" ? "loading..."
    : contextStatus === "ready" ? "ready"
    : contextStatus === "missing" ? "missing"
    : `error: ${contextError ?? "unknown"}`;

  const contextVariant = contextStatus === "ready" ? "success"
    : contextStatus === "missing" ? "warning"
    : contextStatus === "loading" ? "info"
    : "error";

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Diagnostics</SectionHeader>
          <KeyValue
            label="Server"
            value={
              <Badge variant={serverBadgeVariant} dot>
                {serverLabel}
              </Badge>
            }
            labelWidth={14}
          />
          <KeyValue
            label="Setup"
            value={
              <Badge variant={setupVariant} dot>
                {setupLabel}
              </Badge>
            }
            labelWidth={14}
          />
          <KeyValue
            label="Context"
            value={
              <Badge variant={contextVariant} dot>
                {contextLabel}
              </Badge>
            }
            labelWidth={14}
          />
          {contextStatus === "ready" && contextGeneratedAt && (
            <KeyValue label="Generated at" value={formatTimestamp(contextGeneratedAt)} labelWidth={14} />
          )}
          <KeyValue label="Node version" value={nodeVersion} labelWidth={14} />
          <Box gap={1} marginTop={1}>
            <Button variant="secondary" onPress={handleRefreshAll}>
              Refresh All
            </Button>
            <Button
              variant="primary"
              onPress={handleRegenerateContext}
              disabled={!canRegenerate || isRefreshing}
            >
              {isRefreshing ? "Regenerating..." : contextStatus === "ready" ? "Regenerate Context" : "Generate Context"}
            </Button>
          </Box>
          {isRefreshing && (
            <Box gap={1}>
              <Spinner type="dots" />
              <Text>Regenerating context snapshot...</Text>
            </Box>
          )}
          {contextError && <Text color="red">{contextError}</Text>}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
