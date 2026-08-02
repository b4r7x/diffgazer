import { guardQueryState, useConfigurations } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  findProviderById,
  getProviderRowId,
  mapProviderList,
  type ProviderListRow,
} from "@diffgazer/core/providers";
import { resolveSelectedId, sanitizeTerminalText } from "@diffgazer/core/review";
import type { ClientConfigurationSummary } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { paneBorder } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import { useProviderManagement } from "../hooks/use-provider-management";
import { ApiKeyOverlay } from "./api-key-overlay";
import { COMFORTABLE_DETAILS_ROWS, ProviderDetails } from "./details";
import { ProviderList } from "./list";
import { ModelSelectOverlay } from "./model-select-overlay";

const BROWSE_SHORTCUTS: Shortcut[] = [BACK_SHORTCUT, { key: "Enter", label: "Select" }];

const PROVIDER_LIST_ROW_CHROME = 4;
const PROVIDER_LIST_SUBTITLE_MIN_COLUMNS = 18;

function shouldCompactProviderList(contentWidth: number, providers: ProviderListRow[]): boolean {
  if (providers.length === 0) return true;

  const longestName = providers.reduce((max, row) => Math.max(max, row.product.name.length), 0);

  return (
    contentWidth <= longestName + PROVIDER_LIST_ROW_CHROME + PROVIDER_LIST_SUBTITLE_MIN_COLUMNS
  );
}

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;

function BrowseFooter(): null {
  usePageFooter({ shortcuts: BROWSE_SHORTCUTS });
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

function toSupportedConfiguration(
  configuration: ClientConfigurationSummary | null | undefined,
): SupportedConfigurationSummary | null {
  if (!configuration || configuration.status !== "supported") return null;
  return configuration;
}

export function ProvidersScreen(): ReactElement {
  const { columns, isNarrow } = useResponsive();
  const { contentRows } = useContentZone();
  const { tokens } = useTheme();
  const listWidth = getListWidth({ isNarrow, columns });

  const configurationsQuery = useConfigurations();
  const providers = configurationsQuery.data
    ? mapProviderList(configurationsQuery.data.configurations)
    : [];
  const selectedConfigurationId = configurationsQuery.data?.selectedConfigurationId ?? null;

  const management = useProviderManagement(providers);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [zone, setZone] = useState<"list" | "details">("list");

  const effectiveSelectedId = resolveSelectedId(
    selectedId ?? null,
    providers.map((row) => ({ id: getProviderRowId(row) })),
  );
  const selectedRow = findProviderById(providers, effectiveSelectedId);
  const dialogRow = findProviderById(providers, management.dialogOwner?.rowId);

  const setupDialog =
    management.dialogOwner?.kind === "setup" && dialogRow
      ? { owner: management.dialogOwner, row: dialogRow }
      : null;
  const modelDialog =
    management.dialogOwner?.kind === "model" && dialogRow
      ? { owner: management.dialogOwner, row: dialogRow }
      : null;

  const error = management.mutationError ?? configurationsQuery.error?.message ?? null;

  const hasSelection = effectiveSelectedId !== null;
  const isOverlayOpen = setupDialog !== null || modelDialog !== null;
  const activeZone = hasSelection ? zone : "list";
  const isListActive = !isOverlayOpen && activeZone === "list";
  const isDetailsActive = !isOverlayOpen && activeZone === "details";
  const detailsRows = contentRows - 3 - 2;
  const listContentWidth = Math.max((listWidth ?? columns) - 4, 1);
  const compactList = shouldCompactProviderList(listContentWidth, providers);

  const actions = {
    onSetup: () => {
      if (selectedRow) management.openSetupDialog(getProviderRowId(selectedRow));
    },
    onSelectModel: () => {
      if (selectedRow) management.openModelDialog(getProviderRowId(selectedRow));
    },
    onDelete: () => {
      const configurationId = selectedRow?.configuration?.configurationId;
      const revision = selectedRow?.configuration?.revision;
      if (configurationId != null && revision != null) {
        void management.handleDeleteConfiguration(configurationId, revision);
      }
    },
    onDispatchAction: () => {
      if (selectedRow) void management.handleDispatchReadinessAction(selectedRow);
    },
  };

  useInput(
    (_input, key) => {
      if (key.tab) {
        if (!hasSelection) {
          setZone("list");
          return;
        }
        setZone(activeZone === "list" ? "details" : "list");
      }
    },
    { isActive: !isOverlayOpen },
  );

  useBackHandler({ isActive: !isOverlayOpen });

  const guard = guardQueryState(configurationsQuery, {
    loading: () => (
      <Box flexDirection="column" gap={1}>
        <BrowseFooter />
        <SectionHeader bordered>Providers</SectionHeader>
        <Spinner label="Loading providers..." />
      </Box>
    ),
    error: (err) => (
      <Box flexDirection="column" gap={1}>
        <BrowseFooter />
        <SectionHeader bordered>Providers</SectionHeader>
        <Text color={tokens.error}>Error: {sanitizeTerminalText(err.message)}</Text>
      </Box>
    ),
  });

  if (guard) return guard;

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
          if (!configuration || configuration.status !== "supported") return;
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

  const modelConfiguration = modelDialog
    ? toSupportedConfiguration(modelDialog.row.configuration ?? null)
    : null;

  if (modelDialog && modelConfiguration) {
    return (
      <ModelSelectOverlay
        open
        configuration={modelConfiguration}
        onOpenChange={(open) => {
          if (!open) management.closeDialog(modelDialog.owner);
        }}
        selectedId={modelDialog.row.configuration?.selectedModelId ?? undefined}
        onSelect={(modelId) => management.handleSelectModel(modelDialog.owner, modelId)}
      />
    );
  }

  return (
    <Box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <BrowseFooter />
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
            selectedId={effectiveSelectedId ?? undefined}
            highlightedId={effectiveSelectedId ?? undefined}
            selectedConfigurationId={selectedConfigurationId}
            onSelect={setSelectedId}
            onHighlightChange={setSelectedId}
            isActive={isListActive}
            contentWidth={listContentWidth}
            compact={compactList}
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
            actions={actions}
            isActive={isDetailsActive}
            isPending={management.isSubmitting}
            compact={detailsRows < COMFORTABLE_DETAILS_ROWS}
          />
        </Box>
      </Box>
      {error ? <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text> : null}
    </Box>
  );
}
