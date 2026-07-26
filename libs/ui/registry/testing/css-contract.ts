/**
 * Readers for the CSS files components ship, for the contracts a rendered test
 * cannot see: jsdom applies no stylesheet, and its CSSOM drops rules nested in
 * `@layer` along with every pseudo-element rule, so the source is the contract.
 *
 * Both readers brace-match the block they return instead of scanning to the next
 * `}`. A rule that holds a nested block would otherwise be cut off at that
 * block's closing brace, and every assertion about the declarations after it
 * would pass on text the reader never saw.
 */

function escapeForRegExp(fragment: string): string {
  return fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blockAfter(source: string, header: string): string | null {
  const opener = new RegExp(`${escapeForRegExp(header)}\\s*\\{`).exec(source);
  if (!opener) return null;

  const open = opener.index + opener[0].length - 1;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return null;
}

/** Everything between the braces of `selector`, nested blocks included. */
export function ruleBody(source: string, selector: string): string | null {
  return blockAfter(source, selector);
}

/**
 * Everything between the braces of an at-rule such as `@media (pointer: coarse)`,
 * with the rules nested inside it intact, ready to read further rules out of.
 * Throws rather than returning null: a missing at-rule means the block a suite
 * scopes all of its assertions to is gone, which no assertion below would catch.
 */
export function atRuleBody(source: string, prelude: string): string {
  const body = blockAfter(source, prelude);
  if (body === null) throw new Error(`missing or unbalanced ${prelude}`);
  return body;
}
