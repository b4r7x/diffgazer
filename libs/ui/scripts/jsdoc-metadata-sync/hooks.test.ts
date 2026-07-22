import { describe, expect, it } from "vitest";
import { activeHeadingDoc } from "../../registry/hook-docs/active-heading";
import { composedRefsDoc } from "../../registry/hook-docs/composed-refs";
import { controllableStateDoc } from "../../registry/hook-docs/controllable-state";
import { copyToClipboardDoc } from "../../registry/hook-docs/copy-to-clipboard";
import { floatingPositionDoc } from "../../registry/hook-docs/floating-position";
import { formResetDoc } from "../../registry/hook-docs/form-reset";
import { listboxDoc } from "../../registry/hook-docs/listbox";
import { outsideClickDoc } from "../../registry/hook-docs/outside-click";
import { overflowDetectionDoc } from "../../registry/hook-docs/overflow-detection";
import { overflowItemsDoc } from "../../registry/hook-docs/overflow-items";
import { presenceDoc } from "../../registry/hook-docs/presence";
import { getFunctionDoc, getInterfaceMemberDocs, readSource } from "./support";

type MetadataMember = {
  name: string;
  description?: string;
};

type HookMetadata = {
  parameters?: MetadataMember[];
  returns?: {
    properties?: MetadataMember[];
  };
};

type HookJsDocCase = {
  name: string;
  doc: HookMetadata;
  sourcePath: string;
  hookName: string;
  optionsInterface?: string;
  returnsInterface?: string;
};

type MemberMetadataExclusion = {
  member: string;
  reason: string;
};

const hookCases: HookJsDocCase[] = [
  {
    name: "active-heading",
    doc: activeHeadingDoc,
    sourcePath: "registry/hooks/use-active-heading.ts",
    hookName: "useActiveHeading",
    optionsInterface: "UseActiveHeadingOptions",
    returnsInterface: "UseActiveHeadingReturn",
  },
  {
    name: "composed-refs",
    doc: composedRefsDoc,
    sourcePath: "registry/hooks/use-composed-refs.ts",
    hookName: "useComposedRefs",
  },
  {
    name: "controllable-state",
    doc: controllableStateDoc,
    sourcePath: "registry/hooks/use-controllable-state.ts",
    hookName: "useControllableState",
    optionsInterface: "UseControllableStateOptions",
  },
  {
    name: "copy-to-clipboard",
    doc: copyToClipboardDoc,
    sourcePath: "registry/hooks/use-copy-to-clipboard.ts",
    hookName: "useCopyToClipboard",
    optionsInterface: "UseCopyToClipboardOptions",
    returnsInterface: "UseCopyToClipboardResult",
  },
  {
    name: "floating-position",
    doc: floatingPositionDoc,
    sourcePath: "registry/hooks/use-floating-position.ts",
    hookName: "useFloatingPosition",
    optionsInterface: "UseFloatingPositionOptions",
    returnsInterface: "UseFloatingPositionReturn",
  },
  {
    name: "form-reset",
    doc: formResetDoc,
    sourcePath: "registry/hooks/use-form-reset.ts",
    hookName: "useFormReset",
  },
  {
    name: "listbox",
    doc: listboxDoc,
    sourcePath: "registry/hooks/use-listbox.ts",
    hookName: "useListbox",
    optionsInterface: "UseListboxOptions",
    returnsInterface: "UseListboxReturn",
  },
  {
    name: "outside-click",
    doc: outsideClickDoc,
    sourcePath: "registry/hooks/use-outside-click.ts",
    hookName: "useOutsideClick",
  },
  {
    name: "overflow-detection",
    doc: overflowDetectionDoc,
    sourcePath: "registry/hooks/use-overflow-detection.ts",
    hookName: "useOverflowDetection",
  },
  {
    name: "overflow-items",
    doc: overflowItemsDoc,
    sourcePath: "registry/hooks/use-overflow-items.ts",
    hookName: "useOverflowItems",
    optionsInterface: "UseOverflowItemsOptions",
    returnsInterface: "UseOverflowItemsReturn",
  },
  {
    name: "presence",
    doc: presenceDoc,
    sourcePath: "registry/hooks/use-presence.ts",
    hookName: "usePresence",
    optionsInterface: "UsePresenceOptions",
  },
];

const documentedMemberExclusions: Record<string, MemberMetadataExclusion[]> = {
  "active-heading:UseActiveHeadingOptions": [
    {
      member: "ownerDocument",
      reason:
        "Advanced document injection hook for iframe/test hosts; the public docs table currently keeps the common consumer API only.",
    },
  ],
};

function metadataFields(members: MetadataMember[] | undefined): string[] {
  return (members ?? [])
    .filter((member) => member.description?.trim())
    .map((member) => member.name.replace(/^options\./, "").replace(/^\.\.\./, ""));
}

function expectMetadataDocumentsJSDocMembers({
  caseName,
  typeName,
  sourceDocs,
  metadataNames,
  failures,
}: {
  caseName: string;
  typeName: string;
  sourceDocs: Map<string, string>;
  metadataNames: Set<string>;
  failures: string[];
}): void {
  const key = `${caseName}:${typeName}`;
  const sourceNames = new Set(
    [...sourceDocs.entries()].filter(([, description]) => description.trim()).map(([name]) => name),
  );
  const exclusions = documentedMemberExclusions[key] ?? [];
  const excludedNames = new Set(exclusions.map((exclusion) => exclusion.member));

  for (const exclusion of exclusions) {
    if (!exclusion.reason.trim()) failures.push(`${key}.${exclusion.member}: missing rationale`);
    if (!sourceNames.has(exclusion.member)) failures.push(`${key}.${exclusion.member}: stale`);
    if (metadataNames.has(exclusion.member))
      failures.push(`${key}.${exclusion.member}: documented`);
  }

  for (const name of sourceNames) {
    if (metadataNames.has(name) || excludedNames.has(name)) continue;
    failures.push(`${caseName}: ${typeName}.${name}`);
  }
}

describe("hook metadata JSDoc sync", () => {
  it("backs documented hook metadata fields with exported JSDoc", () => {
    const failures: string[] = [];

    for (const item of hookCases) {
      const source = readSource(item.sourcePath);

      if (item.optionsInterface) {
        const docs = getInterfaceMemberDocs(source, item.optionsInterface);
        for (const field of metadataFields(item.doc.parameters)) {
          if (!docs.get(field)) failures.push(`${item.name}: ${item.optionsInterface}.${field}`);
        }
      } else if (
        metadataFields(item.doc.parameters).length > 0 &&
        !getFunctionDoc(source, item.hookName)
      ) {
        failures.push(`${item.name}: ${item.hookName}`);
      }

      if (item.returnsInterface) {
        const docs = getInterfaceMemberDocs(source, item.returnsInterface);
        for (const field of metadataFields(item.doc.returns?.properties)) {
          if (!docs.get(field)) failures.push(`${item.name}: ${item.returnsInterface}.${field}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("documents every exported JSDoc member in doc metadata", () => {
    const failures: string[] = [];

    for (const item of hookCases) {
      const source = readSource(item.sourcePath);

      if (item.optionsInterface) {
        expectMetadataDocumentsJSDocMembers({
          caseName: item.name,
          typeName: item.optionsInterface,
          sourceDocs: getInterfaceMemberDocs(source, item.optionsInterface),
          metadataNames: new Set(metadataFields(item.doc.parameters)),
          failures,
        });
      }

      if (item.returnsInterface) {
        expectMetadataDocumentsJSDocMembers({
          caseName: item.name,
          typeName: item.returnsInterface,
          sourceDocs: getInterfaceMemberDocs(source, item.returnsInterface),
          metadataNames: new Set(metadataFields(item.doc.returns?.properties)),
          failures,
        });
      }
    }

    expect(failures).toEqual([]);
  });
});
