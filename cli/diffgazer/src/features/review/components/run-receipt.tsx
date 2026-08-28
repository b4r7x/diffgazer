import { formatDuration, getDateLabel, getTimestamp } from "@diffgazer/core/format";
import { buildModelValue, buildScopeValue, CLEAN_RUN_RECEIPT_LABELS } from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { KeyValue } from "../../../components/ui/key-value";
import { useTheme } from "../../../theme/provider";

/**
 * What a run is evidence of once its findings are set aside: the scope it read,
 * the lenses that read it, the model that answered, and how long it took. Each
 * field is optional because a legacy record, or a run still holding its context
 * snapshot, may not carry it.
 */
export interface ReviewRunFacts {
  mode?: ReviewMode;
  fileCount?: number;
  additions?: number;
  deletions?: number;
  lenses?: readonly string[];
  productId?: RunnableProductId;
  modelId?: string;
  /** ISO timestamp of the run, when the record kept one. */
  createdAt?: string;
}

export interface ReviewRunReceipt extends ReviewRunFacts {
  /** Already-formatted run label, e.g. `#A1B2C3`. */
  runLabel: string;
  durationMs: number | undefined;
}

const LABEL_WIDTH = Math.max(
  ...Object.values(CLEAN_RUN_RECEIPT_LABELS).map((label) => label.length),
);

function buildRunValue({ runLabel, createdAt }: ReviewRunReceipt): string {
  if (!createdAt) return runLabel;
  return `${runLabel} · ${getDateLabel(createdAt)} ${getTimestamp(createdAt)}`;
}

/**
 * The run's facts as a left-aligned ledger. The labels stay muted and the values
 * foreground: on the clean state the pass statement above is the screen's one
 * accent, so no row here spends it a second time. A row whose fact the record
 * does not carry is left out rather than filled with a placeholder, matching the
 * web receipt.
 */
export function RunReceiptLedger({ receipt }: { receipt: ReviewRunReceipt }): ReactElement {
  const { tokens } = useTheme();
  const scope = buildScopeValue(receipt);
  const model = buildModelValue(receipt.productId, receipt.modelId);
  const lenses = receipt.lenses ?? [];

  return (
    <Box flexDirection="column">
      {scope ? (
        <KeyValue label={CLEAN_RUN_RECEIPT_LABELS.scope} value={scope} labelWidth={LABEL_WIDTH} />
      ) : null}
      {lenses.length > 0 ? (
        <KeyValue
          label={CLEAN_RUN_RECEIPT_LABELS.lenses}
          value={lenses.join(" · ")}
          labelWidth={LABEL_WIDTH}
        />
      ) : null}
      {model ? (
        <KeyValue
          label={CLEAN_RUN_RECEIPT_LABELS.model}
          value={sanitizeTerminalText(model)}
          labelWidth={LABEL_WIDTH}
        />
      ) : null}
      {receipt.durationMs !== undefined ? (
        <KeyValue
          label={CLEAN_RUN_RECEIPT_LABELS.elapsed}
          value={formatDuration(receipt.durationMs)}
          labelWidth={LABEL_WIDTH}
        />
      ) : null}
      {/* The ErrorGatePanel stitch: the run row reads as the stub torn off the bottom. */}
      <Text color={tokens.muted} dimColor>
        ── ──
      </Text>
      <KeyValue
        label={CLEAN_RUN_RECEIPT_LABELS.run}
        value={buildRunValue(receipt)}
        labelWidth={LABEL_WIDTH}
      />
    </Box>
  );
}
