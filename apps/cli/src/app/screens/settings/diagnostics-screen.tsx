import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useInit } from "../../../hooks/use-init.js";
import { api } from "../../../lib/api.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import { KeyValue } from "../../../components/ui/key-value.js";

type ServerStatus = "checking" | "connected" | "error";
type ContextStatus = "loading" | "ready" | "missing" | "error";

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

  const { data: initData, isLoading: initLoading, error: initError } = useInit();

  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");
  const [serverError, setServerError] = useState<string | null>(null);

  const [contextStatus, setContextStatus] = useState<ContextStatus>("loading");
  const [contextGeneratedAt, setContextGeneratedAt] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = async () => {
    setServerStatus("checking");
    setServerError(null);
    try {
      await api.request("GET", "/api/health");
      setServerStatus("connected");
    } catch (err) {
      setServerStatus("error");
      setServerError(err instanceof Error ? err.message : "Failed to connect to server");
    }
  };

  const loadContextStatus = async () => {
    setContextStatus("loading");
    setContextError(null);
    try {
      const context = await api.getReviewContext();
      setContextStatus("ready");
      setContextGeneratedAt(context.meta.generatedAt);
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;

      if (status === 404) {
        setContextStatus("missing");
        setContextGeneratedAt(null);
        return;
      }

      setContextStatus("error");
      setContextGeneratedAt(null);
      setContextError(err instanceof Error ? err.message : "Failed to load context status");
    }
  };

  const handleRegenerateContext = async () => {
    setIsRefreshing(true);
    setContextError(null);
    try {
      const refreshed = await api.refreshReviewContext({ force: true });
      setContextStatus("ready");
      setContextGeneratedAt(refreshed.meta.generatedAt);
    } catch (err) {
      setContextError(err instanceof Error ? err.message : "Failed to refresh context");
      setContextStatus("error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshAll = async () => {
    await Promise.allSettled([checkHealth(), loadContextStatus()]);
  };

  useEffect(() => {
    void checkHealth();
    void loadContextStatus();
  }, []);

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
            <Button variant="secondary" onPress={() => void handleRefreshAll()}>
              Refresh All
            </Button>
            <Button
              variant="primary"
              onPress={() => void handleRegenerateContext()}
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
