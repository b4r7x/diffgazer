import { formatDuration, formatRunId, getDateLabel, getTimestamp } from "@diffgazer/core/format";
import { buildModelValue, buildScopeValue, CLEAN_RUN_RECEIPT_LABELS } from "@diffgazer/core/review";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { cn } from "@diffgazer/ui/lib/utils";
import { Fragment } from "react";

export interface RunReceiptRow {
  label: string;
  value: string;
}

export interface RunReceiptSource {
  mode?: ReviewMode;
  fileCount?: number;
  additions?: number;
  deletions?: number;
  lenses?: readonly string[];
  lensStats?: readonly LensStat[];
  productId?: RunnableProductId;
  modelId?: string;
  durationMs?: number;
}

/**
 * The run's evidence as ledger rows: what was read, by which lenses, on which
 * model, for how long. A row whose fact the record does not carry is left out
 * rather than filled with a placeholder, so a legacy run shows a shorter
 * receipt instead of a column of dashes.
 */
export function buildRunReceiptRows(source: RunReceiptSource): RunReceiptRow[] {
  const lenses = source.lenses ?? source.lensStats?.map((stat) => stat.lensId);
  const rows: RunReceiptRow[] = [];
  const scope = buildScopeValue(source);
  const model = buildModelValue(source.productId, source.modelId);

  if (scope) rows.push({ label: CLEAN_RUN_RECEIPT_LABELS.scope, value: scope });
  if (lenses && lenses.length > 0) {
    rows.push({ label: CLEAN_RUN_RECEIPT_LABELS.lenses, value: lenses.join(" · ") });
  }
  if (model) rows.push({ label: CLEAN_RUN_RECEIPT_LABELS.model, value: model });
  if (source.durationMs !== undefined) {
    rows.push({
      label: CLEAN_RUN_RECEIPT_LABELS.elapsed,
      value: formatDuration(source.durationMs),
    });
  }
  return rows;
}

/** The stub torn off the bottom of the receipt: which run this was, and when. */
export function buildRunStubRow(
  reviewId: string | null,
  createdAt: string | undefined,
): RunReceiptRow {
  const runLabel = reviewId ? formatRunId(reviewId) : "#unknown";
  const when = createdAt ? ` · ${getDateLabel(createdAt)} ${getTimestamp(createdAt)}` : "";
  return { label: CLEAN_RUN_RECEIPT_LABELS.run, value: `${runLabel}${when}` };
}

export interface RunReceiptProps {
  rows: RunReceiptRow[];
  /** Rendered under the tear-line, as the stub torn off a printed receipt. */
  stub?: RunReceiptRow;
  className?: string;
}

// The route dl in not-found.tsx: an uppercase muted key beside a foreground
// value, at label scale so the values are what the eye lands on.
const RECEIPT_LABEL = "text-[11px] font-bold tracking-widest text-muted-foreground uppercase";
const RECEIPT_VALUE = "break-words text-foreground";

export function RunReceipt({ rows, stub, className }: RunReceiptProps) {
  return (
    // One grid spans both lists so the stub's key lines up with the keys above
    // it; each list stays its own <dl> because the tear-line between them is
    // neither a term nor a definition.
    <div
      className={cn("grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1 text-sm", className)}
    >
      <dl className="contents">
        {rows.map((row) => (
          <Fragment key={row.label}>
            <dt className={RECEIPT_LABEL}>{row.label}</dt>
            <dd className={RECEIPT_VALUE}>{row.value}</dd>
          </Fragment>
        ))}
      </dl>
      {stub ? (
        <>
          {/* The interrupted rule the failure view and the TUI error gate draw;
              here it is the perforation the run stub is torn off along. */}
          <div aria-hidden="true" className="col-span-full my-1.5 flex gap-1.5">
            <span className="h-px w-4 bg-border" />
            <span className="h-px w-4 bg-border" />
          </div>
          <dl className="contents">
            <dt className={RECEIPT_LABEL}>{stub.label}</dt>
            <dd className={RECEIPT_VALUE}>{stub.value}</dd>
          </dl>
        </>
      ) : null}
    </div>
  );
}
