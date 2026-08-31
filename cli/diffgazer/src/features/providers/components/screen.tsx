import {
  guardQueryState,
  useConfigurations,
  useProviderConsentGate,
  useSettings,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  findProviderById,
  findProviderDialogRow,
  findProviderHotkeyAction,
  getProviderActionLayout,
  getProviderActionShortcuts,
  getProviderDisplay,
  getProviderRowId,
  getUnrecognizedConfigurationActionLayout,
  isConsentGatedProviderAction,
  mapProviderList,
  PROVIDER_ACTION_HOTKEYS,
  type ProviderListRow,
  type ProviderRowControl,
  UNRECOGNIZED_CONFIGURATION_COPY,
} from "@diffgazer/core/providers";
import { resolveSelectedId } from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { canSelectConfiguration } from "@diffgazer/core/schemas/config";
import {
  BACK_SHORTCUT,
  REVIEW_CONSENT_SHORTCUT,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { ProviderConsentOverlay } from "../../../components/shared/provider-consent-overlay";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { paneBorder } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { useProviderManagement } from "../hooks/use-provider-management";
import { ProviderActionsOverlay } from "./actions-overlay";
import { ApiKeyOverlay } from "./api-key-overlay";
import { DeleteConfirmOverlay } from "./delete-confirm-overlay";
import { COMFORTABLE_DETAILS_ROWS, ProviderDetails } from "./details";
import { ProviderList } from "./list";
import { ModelSelectOverlay } from "./model-select-overlay";

// Back, then the primary Enter runs from the list and the accelerators the
// highlighted row can run right now: the footer teaches only live keys, `?`
// lists them all.
function BrowseFooter({ shortcuts = [] }: { shortcuts?: Shortcut[] }): null {
  usePageFooter({ shortcuts: [BACK_SHORTCUT, ...shortcuts] });
  return null;
}

function getListWidth({
  isNarrow,
  columns,
}: {
  isNarrow: boolean;
  columns: number;
}): number | undefined {
  if (isNarrow) return undefined;
  return Math.min(Math.max(Math.floor(columns * 0.4), 28), 48);
}

export function ProvidersScreen(): ReactElement {
  const { columns, isNarrow } = useResponsive();
  const { contentRows } = useContentZone();
  const { tokens } = useTheme();
  const listWidth = getListWidth({ isNarrow, columns });

  const configurationsQuery = useConfigurations();
  const settingsQuery = useSettings();
  // The one consent every provider send rests on. The guard below waits for
  // settings, so a gated action never mistakes "not loaded yet" for missing
  // consent; the notice is asked for just in time, on the first such action.
  const consent = useProviderConsentGate(settingsQuery.data?.providerConsent);
  const providers = configurationsQuery.data
    ? mapProviderList(configurationsQuery.data.configurations)
    : [];
  const unrecognized = configurationsQuery.data?.unrecognizedConfigurations ?? [];
  const selectedConfigurationId = configurationsQuery.data?.selectedConfigurationId ?? null;

  const management = useProviderManagement(providers);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [zone, setZone] = useState<"list" | "details">("list");
  // The screen's own overlay: the More menu, or the confirmation removal
  // waits behind wherever it was asked for.
  const [overlay, setOverlay] = useState<"more" | "delete" | null>(null);

  // Unrecognized records trail the provider rows, in the order the list renders
  // them, so the selection resolver walks one list.
  const effectiveSelectedId = resolveSelectedId(selectedId ?? null, [
    ...providers.map((row) => ({ id: getProviderRowId(row) })),
    ...unrecognized.map(({ configurationId }) => ({ id: configurationId })),
  ]);
  const selectedRow = findProviderById(providers, effectiveSelectedId);
  const selectedUnrecognized =
    unrecognized.find(({ configurationId }) => configurationId === effectiveSelectedId) ?? null;
  const dialogRow = findProviderDialogRow(providers, management.dialogOwner);

  // "Change model" on the review error screen deep-links into the model dialog
  // for the configuration the review ran with. An effect because the rows
  // arrive async; the ref makes the intent one-shot so closing the dialog does
  // not reopen it.
  const { route } = useNavigation();
  const modelIntent = route.screen === "settings/providers" && route.intent === "select-model";
  const modelIntentConsumedRef = useRef(false);
  useEffect(() => {
    if (!modelIntent || modelIntentConsumedRef.current || !configurationsQuery.data) return;
    const activeRow = providers.find(
      (row) => row.configuration?.configurationId === selectedConfigurationId,
    );
    if (!activeRow?.configuration) return;
    modelIntentConsumedRef.current = true;
    const rowId = getProviderRowId(activeRow);
    setSelectedId(rowId);
    management.openModelDialog(rowId);
  });

  const setupDialog =
    management.dialogOwner?.kind === "setup" && dialogRow
      ? { owner: management.dialogOwner, row: dialogRow }
      : null;
  const modelDialog =
    management.dialogOwner?.kind === "model" && dialogRow?.configuration
      ? { owner: management.dialogOwner, configuration: dialogRow.configuration }
      : null;

  const error = management.actionError ?? configurationsQuery.error?.message ?? null;

  const hasSelection = effectiveSelectedId !== null;
  const isOverlayOpen =
    setupDialog !== null || modelDialog !== null || overlay !== null || consent.isOpen;
  const activeZone = hasSelection ? zone : "list";
  const isListActive = !isOverlayOpen && activeZone === "list";
  const isDetailsActive = !isOverlayOpen && activeZone === "details";
  const detailsRows = contentRows - 3 - 2;
  const listContentWidth = Math.max((listWidth ?? columns) - 4, 1);

  const layout = selectedUnrecognized
    ? getUnrecognizedConfigurationActionLayout()
    : getProviderActionLayout(selectedRow, selectedConfigurationId);
  // Enter on the highlighted row runs whatever the row's primary is right now;
  // the active configuration has none, so Enter does nothing there.
  const listPrimary = layout.primary && !layout.primary.disabledReason ? layout.primary : null;

  const dispatchSelected = (row: ProviderListRow) => {
    if (canSelectConfiguration(row.readiness.status)) {
      void management.handleSelectConfiguration(
        row,
        row.configuration?.selectedModelId ?? undefined,
      );
      return;
    }
    void management.handleDispatchReadinessAction(row);
  };

  const deleteSelected = () => {
    // An unrecognized record never showed a revision, so its delete asserts none.
    if (selectedUnrecognized) {
      void management.handleDeleteConfiguration(selectedUnrecognized.configurationId);
      return;
    }
    const configurationId = selectedRow?.configuration?.configurationId;
    const revision = selectedRow?.configuration?.revision;
    if (configurationId != null && revision != null) {
      void management.handleDeleteConfiguration(configurationId, revision);
    }
  };

  // The one dispatch path the action row, the More menu and the accelerators use.
  const runAction = (control: ProviderRowControl) => {
    if (control.id === "more") {
      setOverlay("more");
      return;
    }
    const run = isConsentGatedProviderAction(control)
      ? consent.require
      : (action: () => void) => action();
    switch (control.id) {
      case "dispatch":
      case "selectConfiguration":
        if (selectedRow) run(() => dispatchSelected(selectedRow));
        return;
      case "setup":
        if (selectedRow) run(() => management.openSetupDialog(getProviderRowId(selectedRow)));
        return;
      case "verify": {
        const configurationId = selectedRow?.configuration?.configurationId;
        if (configurationId != null) {
          run(() => void management.handleTestConfiguration(configurationId));
        }
        return;
      }
      case "selectModel":
        if (selectedRow) management.openModelDialog(getProviderRowId(selectedRow));
        return;
      case "delete":
        setOverlay("delete");
        return;
    }
  };

  // Single-letter accelerators, live in both panes; `d` reaches Delete's own
  // confirmation, like every other way to it.
  useInput(
    (input) => {
      const hotkey = PROVIDER_ACTION_HOTKEYS.find(({ key }) => key === input);
      if (!hotkey) return;
      const action = findProviderHotkeyAction(layout, hotkey.key);
      if (action) runAction(action);
    },
    { isActive: !isOverlayOpen && hasSelection && !management.isSubmitting },
  );

  useInput(
    (input) => {
      if (input === REVIEW_CONSENT_SHORTCUT.key) consent.open();
    },
    { isActive: !isOverlayOpen && consent.consent === null },
  );

  useInput(
    (_input, key) => {
      if (key.tab) {
        if (!hasSelection) {
          setZone("list");
          return;
        }
        setZone(activeZone === "list" ? "details" : "list");
        return;
      }
      if (key.rightArrow && hasSelection && activeZone === "list") setZone("details");
    },
    { isActive: !isOverlayOpen },
  );

  useBackHandler({ isActive: !isOverlayOpen });

  const guardViews = {
    loading: () => (
      <Box flexDirection="column" gap={1}>
        <BrowseFooter />
        <SectionHeader bordered>Providers</SectionHeader>
        <Spinner label="Loading providers..." />
      </Box>
    ),
    error: (err: Error) => (
      <Box flexDirection="column" gap={1}>
        <BrowseFooter />
        <SectionHeader bordered>Providers</SectionHeader>
        <Text color={tokens.error}>Error: {sanitizeTerminalText(err.message)}</Text>
      </Box>
    ),
  };
  const guard =
    guardQueryState(configurationsQuery, guardViews) ?? guardQueryState(settingsQuery, guardViews);

  if (guard) return guard;

  if (consent.isOpen) return <ProviderConsentOverlay gate={consent} />;

  if (setupDialog) {
    return (
      <ApiKeyOverlay
        open
        row={setupDialog.row}
        onOpenChange={(open) => {
          if (!open) management.closeDialog(setupDialog.owner);
        }}
        onCreate={async (input, opts) => {
          await management.handleCreateConfiguration(setupDialog.owner, input, opts);
        }}
        onUpdate={async (input, opts) => {
          const configuration = setupDialog.row.configuration;
          if (!configuration) return;
          await management.handleUpdateConfiguration(
            setupDialog.owner,
            {
              configurationId: configuration.configurationId,
              expectedRevision: configuration.revision,
              ...input,
            },
            opts,
          );
        }}
      />
    );
  }

  // The overlay title and the delete prompt name the pool a configured
  // dual-pool row will bill, matching the list row they were opened from.
  const selectedName = selectedRow
    ? getProviderDisplay(
        selectedRow.product.productId,
        undefined,
        selectedRow.configuration?.endpoint,
      )
    : UNRECOGNIZED_CONFIGURATION_COPY.label;

  if (overlay === "more") {
    return (
      <ProviderActionsOverlay
        open
        title={selectedName}
        layout={layout}
        onOpenChange={(open) => setOverlay(open ? "more" : null)}
        onSelect={runAction}
      />
    );
  }

  if (overlay === "delete") {
    return (
      <DeleteConfirmOverlay
        open
        name={selectedName}
        onOpenChange={(open) => setOverlay(open ? "delete" : null)}
        onConfirm={deleteSelected}
      />
    );
  }

  if (modelDialog) {
    return (
      <ModelSelectOverlay
        open
        configuration={modelDialog.configuration}
        onOpenChange={(open) => {
          if (!open) management.closeDialog(modelDialog.owner);
        }}
        selectedId={modelDialog.configuration.selectedModelId ?? undefined}
        onSelect={(modelId, endpoint) =>
          management.handleSelectModel(modelDialog.owner, modelId, endpoint)
        }
      />
    );
  }

  return (
    <Box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <BrowseFooter
        shortcuts={[
          ...(activeZone === "list" && listPrimary
            ? [{ key: "Enter", label: listPrimary.label }]
            : []),
          ...getProviderActionShortcuts(layout),
          ...(consent.consent === null ? [REVIEW_CONSENT_SHORTCUT] : []),
        ]}
      />
      <SectionHeader bordered>Providers</SectionHeader>
      <Box
        flexDirection={isNarrow ? "column" : "row"}
        gap={isNarrow ? 0 : 2}
        flexGrow={1}
        minHeight={0}
      >
        <Box
          flexDirection="column"
          width={listWidth}
          flexShrink={0}
          height="100%"
          {...paneBorder(tokens, isListActive)}
        >
          <ProviderList
            providers={providers}
            unrecognized={unrecognized}
            selectedId={effectiveSelectedId ?? undefined}
            highlightedId={effectiveSelectedId ?? undefined}
            selectedConfigurationId={selectedConfigurationId}
            onSelect={() => {
              if (listPrimary && !management.isSubmitting) runAction(listPrimary);
            }}
            onHighlightChange={setSelectedId}
            isActive={isListActive}
            contentWidth={listContentWidth}
          />
        </Box>
        <Box
          flexDirection="column"
          flexGrow={1}
          height="100%"
          overflow="hidden"
          {...paneBorder(tokens, isDetailsActive)}
        >
          <ProviderDetails
            row={selectedRow}
            unrecognized={selectedUnrecognized}
            layout={layout}
            onAction={runAction}
            onExitLeft={() => setZone("list")}
            isActive={isDetailsActive}
            isPending={management.isSubmitting}
            consentRequired={consent.consent === null}
            compact={detailsRows < COMFORTABLE_DETAILS_ROWS}
          />
        </Box>
      </Box>
      {error ? <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text> : null}
    </Box>
  );
}
