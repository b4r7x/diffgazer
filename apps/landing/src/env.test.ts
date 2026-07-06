import { describe, expect, it } from "vitest";
import { resolveLinks, wireEnvLinks } from "./env";
import { mountLanding } from "./testing/markup";

describe("resolveLinks", () => {
  it("falls back to the public defaults when env is unset", () => {
    expect(resolveLinks({})).toEqual({
      docs: "https://docs.b4r7.dev",
      github: "https://github.com/b4r7x/diffgazer",
    });
  });

  it("prefers configured origins", () => {
    const env = {
      VITE_DOCS_ORIGIN: "https://docs.example",
      VITE_GITHUB_URL: "https://github.example/org/repo",
    };
    expect(resolveLinks(env)).toEqual({
      docs: "https://docs.example",
      github: "https://github.example/org/repo",
    });
  });

  it("rejects non-http link schemes", () => {
    expect(
      resolveLinks({
        VITE_DOCS_ORIGIN: "javascript:alert(1)",
        VITE_GITHUB_URL: "data:text/html,hello",
      }),
    ).toEqual({
      docs: "https://docs.b4r7.dev",
      github: "https://github.com/b4r7x/diffgazer",
    });
  });
});

describe("static fallback links", () => {
  it("ships usable data-link hrefs before JavaScript runs", () => {
    mountLanding();

    for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[data-link]")) {
      expect(anchor.getAttribute("href")).not.toBe("#");
    }
  });
});

describe("wireEnvLinks", () => {
  it("points every data-link anchor at its resolved destination", () => {
    mountLanding();
    wireEnvLinks(document, {
      docs: "https://docs.example",
      github: "https://github.example/org/repo",
    });

    const hrefs = (name: string) =>
      [...document.querySelectorAll<HTMLAnchorElement>(`a[data-link="${name}"]`)].map((a) =>
        a.getAttribute("href"),
      );

    const docs = hrefs("docs");
    const github = hrefs("github");
    const license = hrefs("license");

    expect(docs.length).toBeGreaterThan(0);
    expect(new Set(docs)).toEqual(new Set(["https://docs.example"]));
    expect(github.length).toBeGreaterThan(0);
    expect(new Set(github)).toEqual(new Set(["https://github.example/org/repo"]));
    expect(license.length).toBeGreaterThan(0);
    expect(new Set(license)).toEqual(
      new Set(["https://github.example/org/repo/blob/main/LICENSE"]),
    );
  });
});
