import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getConsumptionMetadata,
  HOSTED_REGISTRY_GATE_NOTE,
  PUBLISH_GATED,
} from "@/lib/consumption-metadata";

const repoRoot = resolve(import.meta.dirname, "../../../..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("consumption metadata API", () => {
  it("maps UI utility consumption metadata to lib paths", () => {
    const meta = getConsumptionMetadata("ui", "compose-refs", "lib");

    expect(meta.packageImport).toBe("@diffgazer/ui/lib/compose-refs");
    expect(meta.copyPath).toBe("src/lib/compose-refs.ts");
    expect(meta.dgaddName).toBe("ui/compose-refs");
    expect(meta.paths.copy.available).toBe(false);
    expect(meta.paths.copy.note).toContain("r.b4r7.dev does not resolve");
    expect(meta.paths.dgadd.command).toBe("pnpm exec dgadd add ui/compose-refs");
    expect(meta.paths.dgadd.note).toContain("local checkout");
    expect(meta.paths.package.available).toBe(false);
  });

  it("maps prefixed keys hook docs to registry ids without double use prefixes", () => {
    const meta = getConsumptionMetadata("keys", "use-navigation", "hook");

    expect(meta.copyPath).toBe("src/hooks/use-navigation.ts");
    expect(meta.dgaddName).toBe("keys/navigation");
    expect(meta.paths.copy.available).toBe(false);
    expect(meta.paths.copy.note).toContain("r.b4r7.dev does not resolve");
    expect(meta.paths.dgadd.command).toBe("pnpm exec dgadd add keys/navigation");
    expect(meta.paths.dgadd.note).toContain("local checkout");
  });

  it("marks provider-backed keys hooks as package-only while keeping package import metadata", () => {
    const meta = getConsumptionMetadata("keys", "use-action-row-navigation", "hook");

    expect(meta.copyPath).toBe("src/hooks/use-action-row-navigation.ts");
    expect(meta.packageImport).toBe("@diffgazer/keys");
    expect(meta.paths.copy.available).toBe(false);
    expect(meta.paths.dgadd.available).toBe(false);
    expect(meta.paths.package.available).toBe(false);
    expect(meta.paths.package.note).toContain("not yet published to npm");
  });
});

describe("consumption metadata publish gate", () => {
  it("keeps the keys README hosted-registry command behind the publish gate", () => {
    const keysReadme = readRepoFile("libs/keys/README.md");
    const installation = readRepoFile("libs/keys/docs/content/getting-started/installation.mdx");
    const shadcnCommand = "npx shadcn add https://r.b4r7.dev/r/keys/navigation.json";

    if (PUBLISH_GATED) {
      expect(keysReadme).toContain(HOSTED_REGISTRY_GATE_NOTE);
      expect(installation).toContain(HOSTED_REGISTRY_GATE_NOTE);
      expect(keysReadme).not.toContain(shadcnCommand);
      expect(installation).not.toContain(shadcnCommand);
      return;
    }

    expect(keysReadme).toContain(shadcnCommand);
    expect(installation).toContain(shadcnCommand);
  });

  it("keeps the publish gate as one exported boolean declaration", () => {
    const source = readRepoFile("apps/docs/src/lib/consumption-metadata.ts");
    const declarations = source.match(
      /^export[ \t]+const[ \t]+PUBLISH_GATED[ \t]*=[ \t]*(true|false)[ \t]*;[ \t]*$/gm,
    );

    expect(declarations?.map((declaration) => declaration.trim())).toEqual([
      `export const PUBLISH_GATED = ${PUBLISH_GATED};`,
    ]);
  });
});
