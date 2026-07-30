import type { DocsTheme } from "./theme-context";

export interface ThemeBootstrapConfig {
  storageKey: string;
  defaultTheme: DocsTheme;
  themeColors: Record<DocsTheme, string>;
  toggleLabels: Record<DocsTheme, string>;
}

/**
 * The pre-hydration theme bootstrap. It is serialized with `Function.prototype.toString`
 * and injected inline in the document head, so it must stay self-contained: every value
 * it needs arrives through `config`, and it may not reference imports, module constants,
 * or anything else outside its own body.
 *
 * The theme-color meta is created here rather than rendered by React: React 19 treats
 * meta as a hoistable it matches by attributes during hydration, so a tag this script
 * had already retinted would be duplicated rather than adopted.
 *
 * The whole body is wrapped in one try/catch, as next-themes' own ThemeScript is: a
 * browser missing MutationObserver would otherwise abort half-applied and throw on
 * every load. The inner storage try/catch is a partial failure it recovers from.
 */
export function themeBootstrap(config: ThemeBootstrapConfig): void {
  try {
    const root = document.documentElement;

    let theme = config.defaultTheme;
    try {
      const stored = localStorage.getItem(config.storageKey);
      if (stored === "dark" || stored === "light") {
        theme = stored;
      }
    } catch {
      // Storage is unreadable in locked-down browsers; keep the default theme.
    }

    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;

    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", config.themeColors[theme]);
    document.head.appendChild(meta);

    const labelToggle = (toggle: Element) => {
      toggle.setAttribute("aria-label", config.toggleLabels[theme]);
      toggle.textContent = theme;
    };

    const labelTogglesIn = (node: Node) => {
      if (node.nodeType !== 1) return;
      const element = node as Element;
      if (element.matches("[data-docs-theme-toggle]")) labelToggle(element);
      element.querySelectorAll("[data-docs-theme-toggle]").forEach(labelToggle);
    };

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach(labelTogglesIn);
      });
    });
    observer.observe(root, { childList: true, subtree: true });
    labelTogglesIn(root);

    document.addEventListener("DOMContentLoaded", () => observer.disconnect(), { once: true });
  } catch {
    // A browser this script cannot run in keeps the served theme.
  }
}
