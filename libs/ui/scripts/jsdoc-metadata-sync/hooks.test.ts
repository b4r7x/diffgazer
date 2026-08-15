import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { activeHeadingDoc } from "../../registry/hook-docs/active-heading.js";
import { composedRefsDoc } from "../../registry/hook-docs/composed-refs.js";
import { controllableStateDoc } from "../../registry/hook-docs/controllable-state.js";
import { copyToClipboardDoc } from "../../registry/hook-docs/copy-to-clipboard.js";
import { floatingIndicatorDoc } from "../../registry/hook-docs/floating-indicator.js";
import { floatingPositionDoc } from "../../registry/hook-docs/floating-position.js";
import { formResetDoc } from "../../registry/hook-docs/form-reset.js";
import { isMobileDoc } from "../../registry/hook-docs/is-mobile.js";
import { listboxDoc } from "../../registry/hook-docs/listbox.js";
import { outsideClickDoc } from "../../registry/hook-docs/outside-click.js";
import { overflowDetectionDoc } from "../../registry/hook-docs/overflow-detection.js";
import { overflowItemsDoc } from "../../registry/hook-docs/overflow-items.js";
import { presenceDoc } from "../../registry/hook-docs/presence.js";
import {
  expectMetadataDocumentsJSDocMembers,
  getFunctionDoc,
  getInterfaceMemberDocs,
  type MemberMetadataExclusion,
  type MetadataMember,
  metadataFields,
  readSource,
  root,
} from "./support.js";

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
    name: "floating-indicator",
    doc: floatingIndicatorDoc,
    sourcePath: "registry/hooks/use-floating-indicator.ts",
    hookName: "useFloatingIndicator",
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
    name: "is-mobile",
    doc: isMobileDoc,
    sourcePath: "registry/hooks/use-is-mobile.ts",
    hookName: "useIsMobile",
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

const HOOK_DOCS_DIR = resolve(root, "registry/hook-docs");

describe("hook metadata JSDoc sync", () => {
  it("enrolls every hook doc in the parity harness", () => {
    const docNames = readdirSync(HOOK_DOCS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => entry.name.slice(0, -3));
    const enrolled = new Set(hookCases.map((item) => item.name));

    expect({
      uncovered: docNames.filter((name) => !enrolled.has(name)),
      stale: [...enrolled].filter((name) => !docNames.includes(name)),
    }).toEqual({ uncovered: [], stale: [] });
  });

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
          exclusions: documentedMemberExclusions,
          failures,
        });
      }

      if (item.returnsInterface) {
        expectMetadataDocumentsJSDocMembers({
          caseName: item.name,
          typeName: item.returnsInterface,
          sourceDocs: getInterfaceMemberDocs(source, item.returnsInterface),
          metadataNames: new Set(metadataFields(item.doc.returns?.properties)),
          exclusions: documentedMemberExclusions,
          failures,
        });
      }
    }

    expect(failures).toEqual([]);
  });
});
