import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import { type EnvLinks, resolveLinks } from "./src/links";

const root = import.meta.dirname;

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function replaceLinkTokens(html: string, links: EnvLinks): string {
  return html
    .replaceAll("%VITE_DOCS_ORIGIN%", escapeHtmlAttribute(links.docs))
    .replaceAll("%VITE_GITHUB_URL%", escapeHtmlAttribute(links.github));
}

export default defineConfig(({ mode }) => {
  const links = resolveLinks(loadEnv(mode, root, "VITE_"));

  return {
    plugins: [
      {
        name: "landing-html-links",
        transformIndexHtml: {
          order: "pre",
          handler: (html) => replaceLinkTokens(html, links),
        },
      },
    ],
    build: {
      rollupOptions: {
        input: {
          main: resolve(root, "index.html"),
          notFound: resolve(root, "404.html"),
        },
      },
    },
  };
});
