import type { CodeBlockToken } from "@diffgazer/ui/components/code-block";
import { parse, type TokenType } from "sugar-high/core";
import { lang, languages } from "sugar-high/lang";

// The shipped CodeBlock token classes (code-block.css), so evidence colors come
// from the theme's --code-* palette instead of a second app-local one.
const TOKEN_CLASSES: Partial<Record<TokenType, string>> = {
  keyword: "code-keyword",
  string: "code-string",
  comment: "code-comment",
  class: "code-type",
  entity: "code-function",
  property: "code-attr",
};

// sugar-high's lang() claims only the canonical extensions; these spell the same
// grammars.
const EXTENSION_ALIASES: Record<string, string> = {
  mjs: "js",
  cjs: "js",
  mts: "ts",
  cts: "ts",
};

// parse() is quadratic on a long unbroken identifier run (a hash or data URI in
// an excerpt), so oversized evidence degrades to plain text instead of blocking
// the main thread.
const MAX_EXCERPT_LENGTH = 10_000;
const MAX_LINE_LENGTH = 2_000;

function configFor(file: string) {
  const name = file.split(/[/\\]/).pop() ?? file;
  const extension = name.match(/\.([^.]+)$/)?.[1] ?? name;

  const id = lang(EXTENSION_ALIASES[extension] ?? extension);
  return languages.find((language) => language.id === id)?.config;
}

/**
 * Split an evidence excerpt into per-line CodeBlock content. Evidence carries no
 * language, so the file extension is the only signal; an extension no grammar
 * claims stays plain text rather than being tokenized as JavaScript.
 */
export function highlightExcerpt(excerpt: string, file: string): (string | CodeBlockToken[])[] {
  const lines = excerpt.split(/\r?\n/);

  const config = configFor(file);
  if (config === undefined) return lines;
  if (excerpt.length > MAX_EXCERPT_LENGTH) return lines;
  if (lines.some((line) => line.length > MAX_LINE_LENGTH)) return lines;

  return parse(excerpt.replaceAll("\r\n", "\n"), config).lines.map((line) =>
    line.tokens
      .filter((token) => token.value.length > 0)
      .map((token) => ({ text: token.value, className: TOKEN_CLASSES[token.type] })),
  );
}
