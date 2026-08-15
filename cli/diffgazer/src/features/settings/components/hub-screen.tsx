import { guardQueryState, useConfigurationInit, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import {
  buildHubValues,
  hasRepositoryReadAccess,
  resolveSelectedConfiguration,
} from "@diffgazer/core/schemas/config";
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
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";

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
            <Box flexDirection="column" gap={1} width="100%">
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

/**
 * The hub row values are the fastest health read in the app, so the ones that
 * carry a "needs attention" state get semantic colour instead of uniform grey.
 */
function getHubValueColors(
  setup: { isTrusted: boolean; isConfigured: boolean; hasStorage: boolean },
  tokens: CliColorTokens,
): Partial<Record<SettingsAction, string>> {
  return {
    trust: setup.isTrusted ? tokens.success : tokens.warning,
    provider: setup.isConfigured ? tokens.success : tokens.warning,
    storage: setup.hasStorage ? tokens.fg : tokens.warning,
  };
}

export function SettingsHubScreen(): ReactElement {
  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });
  useBackHandler();

  const { navigate } = useNavigation();
  const { columns } = useTerminalDimensions();
  const { tokens } = useTheme();
  const initQuery = useConfigurationInit();
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
        <Text color={tokens.error}>Error: {sanitizeTerminalText(err.message)}</Text>
      </HubFrame>
    ),
  });
  if (guard) return guard;

  if (settingsQuery.isLoading || settingsQuery.data == null) {
    return (
      <HubFrame columns={columns}>
        <Spinner label="Loading settings..." />
      </HubFrame>
    );
  }

  const settings = settingsQuery.data;
  const initData = initQuery.data;
  const selected = resolveSelectedConfiguration(initData);
  const setup = {
    isTrusted: hasRepositoryReadAccess(initData?.project.trust, initData?.project.path),
    isConfigured: selected !== null,
    hasStorage: Boolean(settings.secretsStorage),
  };
  const selectedProductId = selected?.configuration.productId ?? null;
  const values = buildHubValues({
    selectedProductId,
    isTrusted: setup.isTrusted,
    theme: settings.theme,
    secretsStorage: settings.secretsStorage,
    agentExecution: settings.agentExecution,
    selectedLensCount: settings.defaultLenses.length,
  });
  const valueColors = getHubValueColors(setup, tokens);
  const settingsError = settingsQuery.error?.message ?? null;

  return (
    <HubFrame
      columns={columns}
      footer={
        <Box marginTop={1} gap={2}>
          <Text color={tokens.muted}>
            project path: {sanitizeTerminalText(initQuery.data?.project.path ?? "unknown")}
          </Text>
          <Text color={tokens.muted}>|</Text>
          <Text color={settingsError ? tokens.error : tokens.muted}>
            {settingsError ? sanitizeTerminalText(settingsError) : "local settings"}
          </Text>
        </Box>
      }
    >
      <Menu variant="hub" onSelect={onSelect}>
        {SETTINGS_MENU_ITEMS.map((item) => (
          <Menu.Item
            key={item.id}
            id={item.id}
            // Caps are this screen's display rule. buildHubValues returns neutral text so
            // the web DOM stays unshouted for screen readers; a terminal has no CSS layer
            // to lift it, so the lift happens here.
            value={values[item.id].toUpperCase()}
            valueColor={valueColors[item.id]}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu>
    </HubFrame>
  );
}
