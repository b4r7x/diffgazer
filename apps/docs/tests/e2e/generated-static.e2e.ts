import { expect, test } from "@playwright/test";

const GENERATED_ASSETS = [
  { path: "/sitemap.xml", content: "<urlset" },
  { path: "/robots.txt", content: "User-agent: *" },
  { path: "/llms.txt", content: "# Diffgazer documentation" },
  { path: "/llms-full.txt", content: "# Installation" },
  { path: "/app/architecture.md", content: "# Architecture" },
] as const;

test.describe("generated static assets in the frozen Nitro server", () => {
  for (const asset of GENERATED_ASSETS) {
    test(`serves ${asset.path}`, async ({ request }) => {
      const response = await request.get(asset.path);

      expect(response.status()).toBe(200);
      expect(await response.text()).toContain(asset.content);
    });
  }
});
