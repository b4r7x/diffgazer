/** Every single-character escape git emits in a C-style quoted path. */
const ESCAPED_BYTES = new Map<string, number>([
  ["a", 0x07],
  ["b", 0x08],
  ["f", 0x0c],
  ["n", 0x0a],
  ["r", 0x0d],
  ["t", 0x09],
  ["v", 0x0b],
  ["\\", 0x5c],
  ['"', 0x22],
]);

const OCTAL_ESCAPE = /^[0-7]{3}$/;

/**
 * Decodes git's C-style quoted path (emitted under `core.quotepath`) by emitting
 * bytes into a buffer and decoding UTF-8 once. Git escapes each non-ASCII UTF-8
 * byte as a separate octal `\NNN`, so per-character `String.fromCharCode` mangles
 * multi-byte sequences into mojibake; building a byte buffer and decoding it as
 * UTF-8 reconstructs the original string. Its only consumer is the diff parser:
 * both `git status` invocations pass `-z`, whose NUL-delimited output is never
 * C-quoted, so `.diffgazer` exclusion and file filtering need no decoding there.
 */
export function unquoteGitPath(path: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < path.length; i++) {
    if (path[i] !== "\\") {
      bytes.push(...Buffer.from(path[i] ?? "", "utf-8"));
      continue;
    }
    const next = path[i + 1];
    const escaped = next === undefined ? undefined : ESCAPED_BYTES.get(next);
    if (escaped !== undefined) {
      bytes.push(escaped);
      i += 1;
    } else if (next && next >= "0" && next <= "7" && OCTAL_ESCAPE.test(path.slice(i + 1, i + 4))) {
      bytes.push(parseInt(path.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(0x5c);
    }
  }
  return Buffer.from(bytes).toString("utf-8");
}
