import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const indexHtml = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "index.html");

/** The `<body>` contents of the shipped index.html, minus its script tag. */
export function bodyMarkup(): string {
  const html = readFileSync(indexHtml, "utf-8");
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? "";
  return body.replace(/<script[\s\S]*?<\/script>/gi, "");
}

/** Render the landing markup into the jsdom document. */
export function mountLanding(): void {
  document.body.innerHTML = bodyMarkup();
}
