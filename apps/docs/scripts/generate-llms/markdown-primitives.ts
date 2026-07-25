function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function markdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  const header = `| ${headers.map(escapeTableCell).join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${row.map((cell) => escapeTableCell(cell)).join(" | ")} |`)
    .join("\n");
  return `${header}\n${divider}\n${body}`;
}

export function codeBlock(code: string, language: string): string {
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(code.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}${language}\n${code.trimEnd()}\n${fence}`;
}
