import { usePageFooter } from "@diffgazer/core/footer";
import { buildHubValues, hasRepositoryReadAccess } from "@diffgazer/core/schemas/config";
import {
  SETTINGS_MENU_ITEMS,
  SETTINGS_SHORTCUTS,
  type SettingsAction,
} from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { Menu, MenuItem } from "@diffgazer/ui/components/menu";
import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";
import { ConfigurationStatus } from "@/components/shared/configuration-status";
import { PathValue } from "@/components/shared/path-value";
import { useConfigData } from "@/hooks/use-config";
import { useFocusWithin } from "@/hooks/use-focus-within";
import { useProviderConsent } from "@/hooks/use-provider-consent";
import { SETTINGS_HIGHLIGHTED_KEY, useScopedRouteState } from "@/hooks/use-scoped-route-state";
import { useTheme } from "@/hooks/use-theme";

// The provider data notice is a dialog over the hub, not a page of its own.
const SETTINGS_ROUTES: Record<Exclude<SettingsAction, "provider-consent">, string> = {
  trust: "/settings/trust-permissions",
  theme: "/settings/theme",
  provider: "/settings/providers",
  storage: "/settings/storage",
  "agent-execution": "/settings/agent-execution",
  analysis: "/settings/analysis",
  diagnostics: "/settings/diagnostics",
};

/**
 * One value vocabulary for the whole column: trusted is loud enough to be a
 * chip, affirmative means the user configured it, default is an always-present
 * preference, and muted is unset or purely navigational.
 */
type HubValueTone = "trusted" | "affirmative" | "default" | "muted";

/**
 * Right-aligned row value. Uppercase is a display rule, not a content rule: the
 * DOM text stays sentence case so screen readers do not spell it out.
 *
 * Affirmative rows carry "configured" in the green tone alone — the registry's
 * success value variants prefix a ✓ this column no longer wants. On the
 * highlighted row the tone hands back to the row foreground so green never sits
 * on the blue fill, while the trusted chip keeps its own fill in every row
 * state and stays legible there.
 */
function HubValue({ tone, children }: { tone: HubValueTone; children: string }) {
  if (tone === "trusted") {
    return (
      <Badge variant="success" size="sm" className="bg-success text-success-foreground">
        {children}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        "text-sm uppercase tracking-[0.08em]",
        tone === "affirmative" && "text-success group-data-[highlighted]:text-current",
      )}
    >
      {children}
    </span>
  );
}

export function SettingsHubPage() {
  const navigate = useNavigate();
  const titleId = useId();
  const { loadState, selectedProductId, isConfigured, repoRoot, trust, settings } = useConfigData();
  const { theme } = useTheme();
  const providerConsent = useProviderConsent();
  const [highlighted, setHighlighted] = useScopedRouteState<string | null>(
    SETTINGS_HIGHLIGHTED_KEY,
    SETTINGS_MENU_ITEMS[0]?.id ?? null,
  );
  const panelFocus = useFocusWithin<HTMLDivElement>();

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useScope("settings-hub");
  useKey("Escape", () => navigate({ to: "/" }));

  if (loadState.status !== "ready") {
    return <ConfigurationStatus status={loadState.status} />;
  }
  if (settings == null) {
    return <ConfigurationStatus status="loading" />;
  }

  const handleActivate = (id: string) => {
    if (id === "provider-consent") {
      providerConsent.open();
      return;
    }
    const route = SETTINGS_ROUTES[id as keyof typeof SETTINGS_ROUTES];
    if (route) {
      navigate({ to: route });
    }
  };

  const isTrusted = hasRepositoryReadAccess(trust, repoRoot);
  const values = buildHubValues({
    selectedProductId,
    isTrusted,
    theme,
    secretsStorage: settings.secretsStorage,
    agentExecution: settings.agentExecution,
    selectedLensCount: settings.defaultLenses.length,
    providerConsent: settings.providerConsent,
  });

  const persistedValueTone = (hasValue: boolean): HubValueTone =>
    hasValue ? "affirmative" : "muted";

  const menuValues: Record<SettingsAction, { value: string; tone: HubValueTone }> = {
    trust: {
      value: values.trust,
      tone: isTrusted ? "trusted" : "muted",
    },
    theme: {
      value: values.theme ?? theme ?? "auto",
      tone: "default",
    },
    provider: {
      value: values.provider,
      tone: isConfigured ? "affirmative" : "muted",
    },
    "provider-consent": {
      value: values["provider-consent"],
      tone: persistedValueTone(settings.providerConsent !== null),
    },
    storage: {
      value: values.storage,
      tone: persistedValueTone(settings.secretsStorage != null),
    },
    "agent-execution": {
      value: values["agent-execution"],
      tone: "default",
    },
    analysis: {
      value: values.analysis,
      tone: persistedValueTone(settings.defaultLenses.length > 0),
    },
    diagnostics: {
      value: values.diagnostics,
      tone: "muted",
    },
  };

  return (
    // Same wrapper rhythm as CardLayout, one step wider: the hub's rows carry
    // label + value pairs, so the card keeps the pre-mobile 3xl width while the
    // single-column children stay at CardLayout's 2xl. Spare height splits 1:2
    // around the card (the shared hero-tier optical band), so hub, children and
    // home hold the same top line and the spacers collapse when content
    // outgrows the viewport.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:p-6 lg:p-8">
      <div aria-hidden className="grow" />
      <div className="mx-auto flex w-full min-h-0 max-w-3xl flex-col">
        {/* Resting chrome until focus actually enters the pane: the hub is a
            single pane, but nothing on screen may claim the focused hue while
            the keyboard is elsewhere. */}
        <Panel
          {...panelFocus.props}
          focused={panelFocus.focusWithin}
          density="compact"
          // Capped to the space below the header: the rows scroll inside the
          // card so the page never scrolls and the footer caption stays put.
          className="flex min-h-0 flex-col shadow-2xl"
          aria-labelledby={titleId}
        >
          <Panel.Label>
            <h1 id={titleId}>Settings Hub</h1>
          </Panel.Label>
          {/* Menu-of-actions over a links list is deliberate (F-231): the hub keeps
              TUI-parity keyboard navigation, and the app runs as a local single-window
              product where new-tab/middle-click link semantics do not apply. */}
          <Menu
            highlighted={highlighted}
            onHighlightChange={setHighlighted}
            onSelect={handleActivate}
            variant="detail"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto text-sm"
            aria-label="Settings"
            autoFocus
          >
            {SETTINGS_MENU_ITEMS.map((item) => {
              const meta = menuValues[item.id];
              return (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  // `group` unconditionally: the registry drops it on the very
                  // state HubValue reads, the highlighted row. The last row
                  // skips its hairline because the footer already draws one.
                  className="group min-h-14 border-border/50 border-b text-base last:border-b-0"
                  value={<HubValue tone={meta.tone}>{meta.value}</HubValue>}
                  valueVariant={meta.tone === "muted" ? "muted" : "default"}
                >
                  {item.label}
                </MenuItem>
              );
            })}
          </Menu>
          {/* One line at every width: PathValue middle-truncates the repo path
              instead of wrapping it, so the caption keeps its own end of the row
              even at 375. */}
          <Panel.Footer className="font-mono">
            <span className="flex min-w-0 items-center">
              <span className="shrink-0">project path:&nbsp;</span>
              <PathValue value={repoRoot ?? "unknown"} />
            </span>
            <span className="shrink-0">local settings</span>
          </Panel.Footer>
        </Panel>
      </div>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
