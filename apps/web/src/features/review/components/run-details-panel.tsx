import type { LensSummaryRow } from "@diffgazer/core/review";
import { Panel } from "@diffgazer/ui/components/panel";

export interface RunDetailsPanelProps {
  notices: string[];
  lensRows: LensSummaryRow[];
}

/**
 * Post-run bookkeeping for the summary screen: collapse/threshold notices and the
 * per-lens outcome table. It is a framed panel above the action row rather than
 * loose text after it, so a failed lens reads as reported status instead of a
 * debug dump trailing the primary call to action.
 */
export function RunDetailsPanel({ notices, lensRows }: RunDetailsPanelProps) {
  if (notices.length === 0 && lensRows.length === 0) return null;

  return (
    <Panel density="compact" aria-label="Run details">
      <Panel.Label variant="border" aria-hidden="true">
        Run Details
      </Panel.Label>
      <Panel.Content spacing="sm">
        {notices.map((notice) => (
          <p key={notice} className="text-muted-foreground text-xs" role="note">
            {notice}
          </p>
        ))}
        {lensRows.length > 0 ? (
          <table className="w-full text-xs">
            <caption className="text-left text-muted-foreground mb-1">Issues by lens</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Lens</th>
                <th scope="col">Issues</th>
              </tr>
            </thead>
            <tbody>
              {lensRows.map((row) => (
                <tr key={row.lensId}>
                  <th className="py-0.5 pr-4 text-left font-normal" scope="row">
                    {row.label}
                  </th>
                  <td className="py-0.5 text-right tabular-nums">
                    {row.status === "failed" ? (
                      <span className="text-warning-text">{formatLensFailure(row.errorCode)}</span>
                    ) : (
                      row.issueCount
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Panel.Content>
    </Panel>
  );
}

// Bracketed code, matching the terminal chip vocabulary the rest of the app uses
// for machine tokens; a bare `failed (RATE_LIMITED)` string read as raw output.
function formatLensFailure(errorCode: string | undefined): string {
  return errorCode ? `failed [${errorCode}]` : "failed";
}
