import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const landingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("landing deployment 404 contract", () => {
  const nginxConfig = readFileSync(join(landingRoot, "../../deploy/landing-nginx.conf"), "utf8");
  const notFoundHtml = readFileSync(join(landingRoot, "404.html"), "utf8");
  const indexHtml = readFileSync(join(landingRoot, "index.html"), "utf8");
  const styles = readFileSync(join(landingRoot, "src/styles/index.css"), "utf8");

  it("serves unknown paths as real 404 responses instead of the landing page", () => {
    const rootLocation = nginxConfig.match(/location \/ \{([\s\S]*?)\n {4}\}/)?.[1];

    expect(rootLocation).toBeDefined();
    expect(rootLocation).toMatch(/try_files \$uri \$uri\/ =404;/);
    expect(rootLocation).not.toContain("/index.html");
    expect(nginxConfig).toMatch(/error_page 404 \/404\.html;/);
    expect(nginxConfig).toMatch(/location = \/404\.html \{[\s\S]*?internal;/);
  });

  it("uses immutable caching only for content-hashed Vite assets", () => {
    const immutableBlock = nginxConfig.match(/location \^~ \/assets\/ \{([\s\S]*?)\n {4}\}/)?.[1];
    const fixedAssetBlock = nginxConfig.match(
      /location ~\* \\.\(js\|css\|png\|jpg\|gif\|ico\|svg\|woff2\?\|ttf\|eot\)\$ \{([\s\S]*?)\n {4}\}/,
    )?.[1];

    expect(immutableBlock).toContain('Cache-Control "public, max-age=31536000, immutable"');
    expect(fixedAssetBlock).toContain('Cache-Control "public, max-age=0, must-revalidate"');
    expect(fixedAssetBlock).not.toContain("immutable");
    expect(indexHtml).toContain('href="/favicon.ico"');
    expect(indexHtml).toContain("/og.png");
    expect(styles).toContain('url("/fonts/DepartureMono-Regular.woff2")');
  });

  it("ships an accessible branded 404 document for the nginx error response", () => {
    const page = new DOMParser().parseFromString(notFoundHtml, "text/html");

    expect(page.title).toMatch(/404.*Diffgazer/i);
    expect(page.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex");
    expect(page.querySelector("main")).not.toBeNull();
    expect(page.querySelector("h1")?.textContent).toMatch(/page not found/i);
    expect(page.querySelector('a[href="/"]')?.textContent).toMatch(/home/i);
    expect(page.querySelector('a[href="%VITE_DOCS_ORIGIN%"]')).not.toBeNull();
    expect(page.querySelector('a[href="%VITE_GITHUB_URL%"]')).not.toBeNull();
  });

  it("links the shared diffgazer icon set on both pages and ships every file it names", () => {
    const hrefs = ["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png"];

    for (const html of [indexHtml, notFoundHtml]) {
      const page = new DOMParser().parseFromString(html, "text/html");
      const iconLinks = [
        ...page.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]'),
      ];
      expect(iconLinks.map((link) => link.getAttribute("href"))).toEqual(hrefs);
    }
    for (const href of hrefs) {
      expect(existsSync(join(landingRoot, "public", href)), href).toBe(true);
    }

    const favicon = readFileSync(join(landingRoot, "public/favicon.svg"), "utf8");
    const sharedMark = readFileSync(
      join(landingRoot, "../../libs/ui/brand/diffgazer-mark.svg"),
      "utf8",
    );
    expect(favicon).toContain(`d="${sharedMark.match(/ d="([^"]+)"/)?.[1]}"`);
  });
});
