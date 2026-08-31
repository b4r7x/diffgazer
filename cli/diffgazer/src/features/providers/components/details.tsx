import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  getProviderDisplay,
  getProviderDisplayStatus,
  getProviderRowControls,
  isProviderControlDisabled,
  PROVIDER_DETAIL_EMPTY_LABEL,
  type ProviderActionLayout,
  type ProviderRowControl,
  UNRECOGNIZED_CONFIGURATION_COPY,
} from "@diffgazer/core/providers";
import type { UnrecognizedConfiguration } from "@diffgazer/core/schemas/config";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { KeyValue } from "../../../components/ui/key-value";
import { useActionRow } from "../../../hooks/use-action-row";
import { useTheme } from "../../../theme/provider";
import { formatModelLabel } from "../lib/model-label";

/**
 * Rows the body needs to breathe: labelled settings rows plus the wrapped action
 * block. Below this the blank lines and the billing notice go first — a dense
 * list beats clipped actions.
 */
export const COMFORTABLE_DETAILS_ROWS = 23;

interface ProviderDetailsProps {
  row?: ProviderListRow | null;
  /**
   * Set instead of `row` when the highlighted list row is a stored record this
   * build could not decode; it takes precedence, because such a record never
   * produces a provider row.
   */
  unrecognized?: UnrecognizedConfiguration | null;
  /** Derived once per selection so the row and the screen's key handlers cannot diverge. */
  layout: ProviderActionLayout;
  onAction: (control: ProviderRowControl) => void;
  onExitLeft?: () => void;
  isActive?: boolean;
  isPending?: boolean;
  /** True until the provider consent is on record; the pane then says how to review it. */
  consentRequired?: boolean;
  compact?: boolean;
}

export function ProviderDetails({
  row,
  unrecognized = null,
  layout,
  onAction,
  onExitLeft,
  isActive = false,
  isPending = false,
  consentRequired = false,
  compact = false,
}: ProviderDetailsProps): ReactElement {
  const { tokens } = useTheme();
  const controls = getProviderRowControls(layout);

  const detailActions = useActionRow({
    actionCount: controls.length,
    disabledActions: controls.map((control) => isProviderControlDisabled(control, isPending)),
    onAction: (index) => {
      const control = controls[index];
      if (control) onAction(control);
    },
    onExitLeft,
    isActive,
  });

  // A dimmed primary says why, the way the web row announces it; the secondary
  // is only ever a runnable action, and menu entries carry their reason in the
  // overlay's value column.
  const disabledReason = layout.primary?.disabledReason;

  // Primary, at most one secondary, then More: the active configuration has
  // nothing left to select, so its status chip takes the primary slot.
  const actionRow = (
    <Box flexDirection="column" marginTop={1}>
      <Box flexWrap="wrap" gap={1}>
        {layout.active ? (
          <Box paddingX={1}>
            <Badge variant="success" dot>
              Active
            </Badge>
          </Box>
        ) : null}
        {controls.map((control, index) => (
          <Button
            key={control.id}
            variant={control === layout.primary ? "primary" : "secondary"}
            isActive={detailActions.isActionActive(index)}
            onPress={() => detailActions.activate(index)}
            disabled={isProviderControlDisabled(control, isPending)}
          >
            {control.label}
          </Button>
        ))}
      </Box>
      {disabledReason ? <Text color={tokens.muted}>{disabledReason}</Text> : null}
    </Box>
  );

  if (unrecognized) {
    return (
      <Box flexDirection="column" gap={compact ? 0 : 1}>
        <KeyValue label="Name" value={UNRECOGNIZED_CONFIGURATION_COPY.label} labelWidth={14} />
        <KeyValue label="Configuration" value={unrecognized.configurationId} labelWidth={14} />
        {actionRow}
        <Text color={tokens.muted}>{UNRECOGNIZED_CONFIGURATION_COPY.description}</Text>
      </Box>
    );
  }

  if (!row) {
    return (
      <Box>
        <Text color={tokens.muted}>{PROVIDER_DETAIL_EMPTY_LABEL}</Text>
      </Box>
    );
  }

  const displayStatus = getProviderDisplayStatus(row.readiness);
  const settingsRows = buildProviderSettingsRows(row);
  const modelId = row.configuration?.selectedModelId;

  return (
    <Box flexDirection="column" gap={compact ? 0 : 1} minHeight={0}>
      {/* Identity and actions are rigid; only the settings list absorbs a short
          pane, so a terminal too small for every row still shows what the
          configuration is and what can be done to it. */}
      <Box flexDirection="column" gap={compact ? 0 : 1} flexShrink={0}>
        {/* The full product name: this pane is the reference view, and the
            endpoint rows below it disambiguate the pool or region. */}
        <KeyValue label="Name" value={getProviderDisplay(row.product.productId)} labelWidth={14} />
        <KeyValue label="Product" value={row.product.productId} labelWidth={14} />
        {/* The narrow list drops the id when the row cannot fit it, so this pane is
            where the configured model is always named in full. */}
        {modelId ? (
          <KeyValue
            label="Model"
            value={formatModelLabel(row.product.productId, modelId)}
            labelWidth={14}
          />
        ) : null}
        <KeyValue
          label="Status"
          value={
            <Badge variant={displayStatus.variant} dot>
              {displayStatus.label}
            </Badge>
          }
          labelWidth={14}
        />
      </Box>

      {/* Rows keep their natural height and the list is clipped instead: a row
          squeezed by flex-shrink still paints its wrapped lines, over its
          neighbours. */}
      <Box flexDirection="column" gap={compact ? 0 : 1} minHeight={0} overflow="hidden">
        {settingsRows.map((settingsRow) => (
          <Box key={settingsRow.id} flexDirection="column" flexShrink={0}>
            <KeyValue label={settingsRow.label} value={settingsRow.value} labelWidth={14} />
            {/* The billing notice and the bound endpoint's URL, when the pane has
                room for them. The other fact descriptions stay out: they repeat
                the product blurb and the remediation line under the actions. */}
            {!compact &&
            settingsRow.description &&
            (settingsRow.kind === "prose" || settingsRow.id === "endpoint") ? (
              <Text color={tokens.muted}>{settingsRow.description}</Text>
            ) : null}
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" gap={compact ? 0 : 1} flexShrink={0}>
        {actionRow}

        {/* Neutral, not a warning: the app stays usable without the consent, and
            declining the notice must leave a way back to it. */}
        {consentRequired ? (
          <Text color={tokens.muted}>Consent required to run reviews · [c] Review</Text>
        ) : null}

        {/* What to do about the status, including what Verify costs. It
            seats under the actions like the web rail so a long remediation cannot
            push the buttons out of this clipped pane. */}
        {row.readiness.remediation.code === "none" ? null : (
          <Text color={tokens.muted}>{displayStatus.remediation}</Text>
        )}
      </Box>
    </Box>
  );
}
