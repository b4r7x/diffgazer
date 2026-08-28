import { Typography } from "@diffgazer/ui/components/typography";
import { RunReceipt, type RunReceiptRow } from "@/components/shared/run-receipt";

export interface CleanRunViewProps {
  statement: string;
  rows: RunReceiptRow[];
  stub: RunReceiptRow;
  notices: string[];
}

/**
 * What a run with no findings has to show: the verdict, then the evidence that
 * makes the verdict checkable. No panels of zeros and no charts with nothing in
 * them — the screen reads as a printed receipt, and the statement is the one
 * place the success token is spent.
 */
export function CleanRunView({ statement, rows, stub, notices }: CleanRunViewProps) {
  return (
    <div className="flex flex-col gap-6 px-1 pb-2">
      <Typography as="h1" size="lg" className="text-success-text sm:text-2xl">
        {/* The tick is the statement's own punctuation; the sentence beside it
            already says the whole thing to assistive tech. */}
        <span aria-hidden="true">✔</span> {statement}
      </Typography>
      <RunReceipt rows={rows} stub={stub} />
      {notices.length > 0 ? (
        <div className="space-y-1">
          {notices.map((notice) => (
            <p key={notice} className="text-muted-foreground text-xs" role="note">
              {notice}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
