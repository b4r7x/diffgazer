/**
 * Decodes git's C-style quoted path (emitted under `core.quotepath`) by emitting
 * bytes into a buffer and decoding UTF-8 once. Git escapes each non-ASCII UTF-8
 * byte as a separate octal `\NNN`, so per-character `String.fromCharCode` mangles
 * multi-byte sequences into mojibake; building a byte buffer and decoding it as
 * UTF-8 reconstructs the original string. Shared by the diff parser and the
 * porcelain status parser so file filtering and `.diffgazer` exclusion match
 * non-ASCII paths identically.
 */
export function unquoteGitPath(path: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < path.length; i++) {
    if (path[i] !== "\\") {
      bytes.push(...Buffer.from(path[i] ?? "", "utf-8"));
      continue;
    }
    const next = path[i + 1];
    if (next === "\\" || next === '"') {
      bytes.push(next.charCodeAt(0));
      i += 1;
    } else if (next === "t") {
      bytes.push(0x09);
      i += 1;
    } else if (next === "n") {
      bytes.push(0x0a);
      i += 1;
    } else if (next === "r") {
      bytes.push(0x0d);
      i += 1;
    } else if (next && next >= "0" && next <= "7" && /^[0-7]{3}$/.test(path.slice(i + 1, i + 4))) {
      bytes.push(parseInt(path.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(0x5c);
    }
  }
  return Buffer.from(bytes).toString("utf-8");
}
