import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { useKeyDoc } from "../../../docs/hook-docs/use-key.js";

const plain = (text: string) => text.replace(/[`*]/g, "");

describe("KeyboardProvider docs contract", () => {
  it("keeps the Types prevention contract aligned with the KeyboardProvider reference", () => {
    const docsDirectory = resolve(process.cwd(), "docs/content/api");
    const providerPage = readFileSync(resolve(docsDirectory, "keyboard-provider.mdx"), "utf8");
    const typesPage = readFileSync(resolve(docsDirectory, "types.mdx"), "utf8");
    const providerContract = providerPage.match(/^- `preventDefault` contract\. (.+)$/m)?.[1];

    expect(providerContract).toBeDefined();
    expect(typesPage).toContain(providerContract);
  });

  it("keeps the useKey hook-doc prevention contract aligned with the KeyboardProvider reference", () => {
    const providerPage = readFileSync(
      resolve(process.cwd(), "docs/content/api/keyboard-provider.mdx"),
      "utf8",
    );
    const providerContract = providerPage.match(/^- `preventDefault` contract\. (.+)$/m)?.[1];
    const declineNote = useKeyDoc.notes?.find(
      (note) => note.title === "Declining a match",
    )?.content;

    expect(providerContract).toBeDefined();

    const contract = plain(providerContract ?? "");
    const note = plain(declineNote ?? "");

    expect(contract).toContain("after that handler returns");
    expect(contract).toContain("A declining handler never prevents the default");
    expect(note).toContain("after that handler returns");
    expect(note).toContain("A declining handler never prevents the default");
  });
});
