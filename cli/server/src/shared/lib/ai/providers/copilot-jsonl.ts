import { err, ok, type Result } from "@diffgazer/core/result";

/** Terminal-record projection of one complete Copilot JSONL stdout stream. */
export type CopilotJsonlStream = Readonly<{
  acceptedEventKinds: string[];
  acceptedFieldPaths: string[];
  resultTextFieldPath: string;
  terminalRecord: Record<string, unknown>;
}>;

export type CopilotJsonlFailureCode = "not-jsonl" | "malformed-line" | "partial-terminal";

/**
 * Parses a complete Copilot JSONL stream into its terminal record. Probe and
 * runtime share this contract so conformance evidence cannot accept a stream the
 * runtime would reject: every non-empty line must be a JSON object, and trailing
 * malformed data fails the whole stream rather than being silently dropped.
 */
export function parseCopilotJsonlStream(
  stdout: string,
): Result<CopilotJsonlStream, { code: CopilotJsonlFailureCode }> {
  if (stdout.trim().length === 0) {
    return err({ code: "partial-terminal" });
  }

  if (!stdout.includes("\n")) {
    return err({ code: "not-jsonl" });
  }

  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const records: Record<string, unknown>[] = [];
  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      return err({ code: "malformed-line" });
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return err({ code: "malformed-line" });
    }
    records.push(parsed as Record<string, unknown>);
  }

  const terminalRecord = records.at(-1);
  if (!terminalRecord) {
    return err({ code: "partial-terminal" });
  }

  const acceptedEventKinds = [
    ...new Set(
      records
        .map((record) => (typeof record.type === "string" ? record.type : null))
        .filter((value): value is string => value !== null),
    ),
  ].sort((left, right) => left.localeCompare(right));

  const acceptedFieldPaths = Object.keys(terminalRecord).sort((left, right) =>
    left.localeCompare(right),
  );

  return ok({
    acceptedEventKinds,
    acceptedFieldPaths,
    resultTextFieldPath: acceptedFieldPaths.includes("issues")
      ? "issues"
      : (acceptedFieldPaths[0] ?? "issues"),
    terminalRecord,
  });
}
