import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Comments carry braces and selector names, so brace scanning and selector
 * matching would otherwise resolve against prose instead of CSS.
 */
function stripComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

const css = stripComments(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "styles", "index.css"), "utf8"),
);

/** The shipped stylesheet source, minus comments. */
export function styleSheet(): string {
  return css;
}

/** The bodies of every `@media (<query>)` block, concatenated. */
export function mediaBlocks(query: string): string {
  const opener = `@media (${query}) {`;
  const blocks: string[] = [];
  for (let from = css.indexOf(opener); from !== -1; from = css.indexOf(opener, from + 1)) {
    let depth = 0;
    for (let i = from; i < css.length; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}" && --depth === 0) {
        blocks.push(css.slice(from + opener.length, i));
        break;
      }
    }
  }
  if (blocks.length === 0) throw new Error(`no @media (${query}) block`);
  return blocks.join("\n");
}

/**
 * Declarations of the one rule in `block` whose selector list mentions every
 * given selector. Anchoring on the selector rather than on a whitespace-exact
 * regex of the whole rule keeps these assertions about the contract instead of
 * about how the declarations happen to be formatted.
 */
export function ruleFor(source: string, ...selectors: string[]): string {
  const block = stripComments(source);
  let depth = 0;
  let start = 0;
  let open = -1;
  for (let i = 0; i < block.length; i++) {
    if (block[i] === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (block[i] === "}" && --depth === 0) {
      const selector = block.slice(start, open);
      if (selectors.every((wanted) => selector.includes(wanted))) {
        return block.slice(open + 1, i);
      }
      start = i + 1;
    }
  }
  throw new Error(`no rule matching ${selectors.join(" + ")}`);
}
