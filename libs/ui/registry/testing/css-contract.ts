/**
 * Readers for the CSS files components ship, for the contracts a rendered test
 * cannot see: jsdom applies no stylesheet, and its CSSOM drops rules nested in
 * `@layer` along with every pseudo-element rule, so the source is the contract.
 *
 * Every reader here brace-matches the block it returns instead of scanning to the
 * next `}`. A rule that holds a nested block would otherwise be cut off at that
 * block's closing brace, and every assertion about the declarations after it
 * would pass on text the reader never saw.
 */

/**
 * The formatter decides where a long selector breaks, so a caller writing one on
 * a single line still has to match the wrapped source: every whitespace run is
 * interchangeable, and `:not(…)` may hold its argument on its own line.
 */
function toSelectorPattern(fragment: string): string {
  return fragment
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+")
    .replace(/:not\\\(/g, ":not\\(\\s*")
    .replace(/\\\)/g, "\\s*\\)");
}

/** Index of the `}` closing the `{` at `open`, or -1 when the source is unbalanced. */
function closingBraceIndex(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Everything between the braces of `selector`, nested blocks included; null only
 * when the selector is absent. An opener the reader cannot close throws instead,
 * so a suite asserting a rule is gone never reads "absent" for CSS it failed to
 * parse.
 */
export function ruleBody(source: string, selector: string): string | null {
  const opener = new RegExp(`${toSelectorPattern(selector)}\\s*\\{`).exec(source);
  if (!opener) return null;

  const open = opener.index + opener[0].length - 1;
  return source.slice(open + 1, requireClosingBrace(source, open));
}

/**
 * Everything between the braces of an at-rule such as `@media (pointer: coarse)`,
 * with the rules nested inside it intact, ready to read further rules out of.
 * Throws rather than returning null: a missing at-rule means the block a suite
 * scopes all of its assertions to is gone, which no assertion below would catch.
 */
export function atRuleBody(source: string, prelude: string): string {
  const body = ruleBody(source, prelude);
  if (body === null) throw new Error(`missing ${prelude}`);
  return body;
}

export interface CssRule {
  /**
   * The rule's own selector, prefixed by the selectors and at-rule preludes it
   * nests inside, so a gate a suite looks for is still readable on a nested rule.
   */
  selector: string;
  /** The rule's own declarations; nested rules are enumerated separately. */
  declarations: string;
}

/** Selector text as CSS means it: comments gone, wrapped lines rejoined. */
function normalizeSelector(prelude: string): string {
  return prelude
    .slice(prelude.lastIndexOf(";") + 1)
    .replace(/\s+/g, " ")
    .trim();
}

function requireClosingBrace(source: string, open: number): number {
  const close = closingBraceIndex(source, open);
  if (close === -1) throw new Error("unbalanced CSS block");
  return close;
}

/** The declarations of a block, minus the nested rules and their preludes. */
function ownDeclarations(body: string): string {
  let declarations = "";
  let cursor = 0;

  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "{") continue;
    const segment = body.slice(cursor, index);
    declarations += segment.slice(0, segment.lastIndexOf(";") + 1);
    const close = requireClosingBrace(body, index);
    cursor = close + 1;
    index = close;
  }

  return declarations + body.slice(cursor);
}

function collectRules(source: string, context: string): CssRule[] {
  const rules: CssRule[] = [];
  let cursor = 0;

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{") continue;

    const close = requireClosingBrace(source, index);
    const own = normalizeSelector(source.slice(cursor, index));
    const selector = context ? `${context} ${own}` : own;
    const body = source.slice(index + 1, close);

    rules.push({ selector, declarations: ownDeclarations(body) });
    rules.push(...collectRules(body, selector));

    cursor = close + 1;
    index = close;
  }

  return rules;
}

/**
 * Every rule in `source`, at any nesting depth. A declaration written after a
 * nested block still belongs to the rule that wrote it — the text a scanner
 * cutting at the first `}` silently drops, which is how a suite that filters
 * rules by their declarations passes over CSS it never read.
 */
export function eachRule(source: string): CssRule[] {
  return collectRules(source.replace(/\/\*[\s\S]*?\*\//g, ""), "");
}
