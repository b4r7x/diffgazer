import { describe, expect, it } from "vitest";
import type { DocsLibraryConfigData } from "@/lib/libraries-config";
import type { LandingSection } from "@/lib/page-tree";
import { buildHomeLibrary } from "./data";

const APP_CONFIG = {
  id: "app",
  displayName: "diffgazer",
  logoText: "diffgazer",
  githubUrl: "https://github.com/b4r7x/diffgazer",
  enabled: true,
  defaultRouteSlugs: ["getting-started", "installation"],
} satisfies DocsLibraryConfigData;

const UI_CONFIG = {
  id: "ui",
  displayName: "@diffgazer/ui",
  logoText: "@diffgazer/ui",
  githubUrl: "https://github.com/b4r7x/diffgazer/tree/main/libs/ui",
  enabled: true,
  defaultRouteSlugs: ["getting-started", "installation"],
} satisfies DocsLibraryConfigData;

const SECTIONS: LandingSection[] = [
  {
    name: "Getting Started",
    items: [{ name: "Installation", url: "/ui/getting-started/installation" }],
  },
  {
    name: "Components",
    items: [
      { name: "Button", url: "/ui/components/button" },
      { name: "Card", url: "/ui/components/card" },
    ],
  },
  {
    name: "Hooks",
    items: [{ name: "useListbox", url: "/ui/hooks/listbox" }],
  },
  { name: "Project", items: [{ name: "Changelog", url: "/ui/changelog" }] },
];

const APP_SECTIONS: LandingSection[] = [
  {
    name: "Getting Started",
    items: [{ name: "Installation", url: "/app/getting-started/installation" }],
  },
  {
    name: "Product",
    items: [{ name: "Story", url: "/app/story" }],
  },
  {
    name: "Concepts",
    items: [{ name: "Overview", url: "/app/concepts/overview" }],
  },
  {
    name: "Registry CLI",
    items: [{ name: "dgadd", url: "/app/cli/dgadd" }],
  },
];

describe("buildHomeLibrary", () => {
  it("surfaces every app section in sidebar order", () => {
    const result = buildHomeLibrary(APP_CONFIG, "app", APP_SECTIONS);
    expect(result.sections.map((section) => section.name)).toEqual([
      "Getting Started",
      "Product",
      "Concepts",
      "Registry CLI",
    ]);
  });

  it("derives section deep links as /$lib/$ splats from the first page", () => {
    const result = buildHomeLibrary(UI_CONFIG, "ui", SECTIONS);
    expect(result.sections).toEqual([
      {
        name: "Getting Started",
        splat: "getting-started/installation",
        count: 1,
      },
      { name: "Components", splat: "components/button", count: 2 },
      { name: "Hooks", splat: "hooks/listbox", count: 1 },
    ]);
  });

  it("only surfaces curated main sections, dropping the rest", () => {
    const result = buildHomeLibrary(UI_CONFIG, "ui", SECTIONS);
    expect(result.sections.map((s) => s.name)).not.toContain("Project");
  });
});
