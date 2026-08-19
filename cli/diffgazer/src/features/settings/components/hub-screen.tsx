import {
  guardQueryState,
  useConfigurationInit,
  useProviderConsentGate,
  useSettings,
} from "@diffgazer/core/api/hooks";
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
import { useState } from "react";
import { ProviderConsentOverlay } from "../../../components/shared/provider-consent-overlay";
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

// The provider data notice is an overlay over the hub, not a screen of its own.
const SETTINGS_ROUTE_MAP: Record<Exclude<SettingsAction, "provider-consent">, Route> = {
  trust: { screen: "settings/trust-permissions" },
  theme: { screen: "settings/theme" },
  provider: { screen: "settings/providers" },
  storage: { screen: "settings/storage" },
  "agent-execution": { screen: "settings/agent-execution" },
  analysis: { screen: "settings/analysis" },
  diagnostics: { screen: "settings/diagnostics" },
};

/**
 * Branch-scoped footer publisher: it unmounts with the hub frame when the
 * provider data notice takes the screen, so the overlay's own `usePageFooter`
 * owns the bar instead of being overwritten by a parent effect.
 */
function HubFooter(): null {
  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });
  return null;
}

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
      <HubFooter />
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
  const { navigate } = useNavigation();
  const { columns } = useTerminalDimensions();
  const { tokens } = useTheme();
  const initQuery = useConfigurationInit();
  const settingsQuery = useSettings();
  const consent = useProviderConsentGate(settingsQuery.data?.providerConsent);
  // Screen state, not the menu's: the notice overlay replaces the hub frame, and
  // the row it was opened from must still be highlighted when the frame is back.
  const [highlightedId, setHighlightedId] = useState<SettingsAction | null>(null);

  useBackHandler({ isActive: !consent.isOpen });

  const onSelect = (id: SettingsAction) => {
    if (id === "provider-consent") {
      consent.open();
      return;
    }
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

  if (consent.isOpen) return <ProviderConsentOverlay gate={consent} />;

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
    providerConsent: settings.providerConsent,
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
      <Menu
        variant="hub"
        highlightedId={highlightedId}
        onHighlightChange={setHighlightedId}
        onSelect={onSelect}
      >
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
