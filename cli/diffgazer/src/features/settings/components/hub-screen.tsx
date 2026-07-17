import { guardQueryState, useInit, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { buildHubValues, hasRepositoryReadAccess } from "@diffgazer/core/schemas/config";
import {
  SETTINGS_MENU_ITEMS,
  SETTINGS_SHORTCUTS,
  type SettingsAction,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement, ReactNode } from "react";
import { Menu } from "../../../components/ui/menu";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import type { Route } from "../../../lib/routes";

const SETTINGS_ROUTE_MAP: Record<SettingsAction, Route> = {
  trust: { screen: "settings/trust-permissions" },
  theme: { screen: "settings/theme" },
  provider: { screen: "settings/providers" },
  storage: { screen: "settings/storage" },
  "agent-execution": { screen: "settings/agent-execution" },
  analysis: { screen: "settings/analysis" },
  diagnostics: { screen: "settings/diagnostics" },
};

function HubFrame({
  columns,
  children,
  footer,
}: {
  columns: number;
  children: ReactNode;
  footer?: ReactNode;
}): ReactElement {
  return (
    <Box justifyContent="center" alignItems="center" flexGrow={1}>
      <Box width={Math.min(columns, 70)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader variant="muted" bold={false}>
                Settings Hub
              </SectionHeader>
              {children}
            </Box>
          </Panel.Content>
        </Panel>
        {footer}
      </Box>
    </Box>
  );
}

export function SettingsHubScreen(): ReactElement {
  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });
  useBackHandler();

  const { navigate } = useNavigation();
  const { columns } = useTerminalDimensions();
  const initQuery = useInit();
  const settingsQuery = useSettings();

  const onSelect = (id: SettingsAction) => {
    navigate(SETTINGS_ROUTE_MAP[id]);
  };

  const guard = guardQueryState(initQuery, {
    loading: () => (
      <HubFrame columns={columns}>
        <Spinner label="Loading settings..." />
      </HubFrame>
    ),
    error: (err) => (
      <HubFrame columns={columns}>
        <Text color="red">Error: {err.message}</Text>
      </HubFrame>
    ),
  });
  if (guard) return guard;

  if (settingsQuery.isLoading) {
    return (
      <HubFrame columns={columns}>
        <Spinner label="Loading settings..." />
      </HubFrame>
    );
  }

  const values = buildHubValues({
    provider: initQuery.data?.config?.provider,
    isConfigured: initQuery.data?.setup?.isConfigured ?? false,
    isTrusted: hasRepositoryReadAccess(initQuery.data?.project.trust, initQuery.data?.project.path),
    theme: settingsQuery.data?.theme,
    secretsStorage: settingsQuery.data?.secretsStorage,
    agentExecution: settingsQuery.data?.agentExecution,
    selectedLensCount: settingsQuery.data?.defaultLenses?.length,
  });
  const settingsError = settingsQuery.error?.message ?? null;

  return (
    <HubFrame
      columns={columns}
      footer={
        <Box marginTop={1} gap={2}>
          <Text dimColor>config path: ~/.diffgazer/config.json</Text>
          <Text dimColor>|</Text>
          <Text color={settingsError ? "red" : undefined} dimColor={!settingsError}>
            {settingsError ?? "local settings"}
          </Text>
        </Box>
      }
    >
      <Menu variant="hub" onSelect={onSelect}>
        {SETTINGS_MENU_ITEMS.map((item) => (
          <Menu.Item key={item.id} id={item.id} value={values[item.id]}>
            {item.label}
          </Menu.Item>
        ))}
      </Menu>
    </HubFrame>
  );
}
