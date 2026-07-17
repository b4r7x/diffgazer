import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { checkboxDoc } from "../registry/component-docs/checkbox";
import { dialogDoc } from "../registry/component-docs/dialog";
import { menuDoc } from "../registry/component-docs/menu";
import { radioDoc } from "../registry/component-docs/radio";
import { selectDoc } from "../registry/component-docs/select";
import { activeHeadingDoc } from "../registry/hook-docs/active-heading";
import { composedRefsDoc } from "../registry/hook-docs/composed-refs";
import { controllableStateDoc } from "../registry/hook-docs/controllable-state";
import { copyToClipboardDoc } from "../registry/hook-docs/copy-to-clipboard";
import { floatingPositionDoc } from "../registry/hook-docs/floating-position";
import { formResetDoc } from "../registry/hook-docs/form-reset";
import { listboxDoc } from "../registry/hook-docs/listbox";
import { outsideClickDoc } from "../registry/hook-docs/outside-click";
import { overflowDetectionDoc } from "../registry/hook-docs/overflow-detection";
import { overflowItemsDoc } from "../registry/hook-docs/overflow-items";
import { presenceDoc } from "../registry/hook-docs/presence";

type MetadataMember = {
  name: string;
  description?: string;
};

type PropMetadata = {
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
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

type ComponentJsDocCase = {
  name: string;
  doc: {
    props?: Record<string, Record<string, PropMetadata>>;
  };
  sourcePath: string;
  partName: string;
  propsType: string;
};

type MemberMetadataExclusion = {
  member: string;
  reason: string;
};

type RequiredSelectMetadataCase = {
  sourcePath: string;
  propsType: string;
  partName: "SelectContent" | "SelectSearch" | "SelectValue";
  members: Record<
    string,
    {
      type: string;
      defaultValue: string;
      description: RegExp;
    }
  >;
};

const root = resolve(import.meta.dirname, "..");

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

const componentCases: ComponentJsDocCase[] = [
  {
    name: "checkbox",
    doc: checkboxDoc,
    sourcePath: "registry/ui/checkbox/checkbox-group.tsx",
    partName: "CheckboxGroup",
    propsType: "CheckboxGroupProps",
  },
  {
    name: "menu",
    doc: menuDoc,
    sourcePath: "registry/ui/menu/menu.tsx",
    partName: "Menu",
    propsType: "MenuProps",
  },
  {
    name: "radio",
    doc: radioDoc,
    sourcePath: "registry/ui/radio/radio-group.tsx",
    partName: "RadioGroup",
    propsType: "RadioGroupProps",
  },
  {
    name: "select-content",
    doc: selectDoc,
    sourcePath: "registry/ui/select/select-content.tsx",
    partName: "SelectContent",
    propsType: "SelectContentProps",
  },
  {
    name: "select-search",
    doc: selectDoc,
    sourcePath: "registry/ui/select/select-search.tsx",
    partName: "SelectSearch",
    propsType: "SelectSearchProps",
  },
  {
    name: "select-value",
    doc: selectDoc,
    sourcePath: "registry/ui/select/select-value.tsx",
    partName: "SelectValue",
    propsType: "SelectValueProps",
  },
];

const requiredSelectMetadataCases: RequiredSelectMetadataCase[] = [
  {
    sourcePath: "registry/ui/select/select-content.tsx",
    propsType: "SelectContentProps",
    partName: "SelectContent",
    members: {
      getResultsLabel: {
        type: "(count: number) => string",
        defaultValue: 'count => count + " results"',
        description: /results count.*live region/i,
      },
    },
  },
  {
    sourcePath: "registry/ui/select/select-value.tsx",
    propsType: "SelectValueProps",
    partName: "SelectValue",
    members: {
      getSelectedLabel: {
        type: "(count: number) => string",
        defaultValue: 'count => count + " selected"',
        description: /summary.*display="count"/i,
      },
      getOverflowLabel: {
        type: "(count: number) => string",
        defaultValue: 'count => " +" + count + " more"',
        description: /overflow suffix.*display="truncate"/i,
      },
    },
  },
  {
    sourcePath: "registry/ui/select/select-search.tsx",
    propsType: "SelectSearchProps",
    partName: "SelectSearch",
    members: {
      placeholder: {
        type: "string",
        defaultValue: '"Search..."',
        description: /placeholder.*search input/i,
      },
      "aria-label": {
        type: "string",
        defaultValue: '"Search options" unless aria-labelledby is present',
        description: /accessible name.*search combobox/i,
      },
    },
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
  "checkbox:CheckboxGroupProps": [
    {
      member: "onKeyDown",
      reason:
        "Native event escape hatch is part of the type surface but omitted from the curated public props table.",
    },
    {
      member: "size",
      reason:
        "Group-level style token duplicates item styling; metadata ownership is outside this batch.",
    },
    {
      member: "variant",
      reason:
        "Group-level style token duplicates item styling; metadata ownership is outside this batch.",
    },
    {
      member: "strikethrough",
      reason:
        "Group-level style token duplicates item styling; metadata ownership is outside this batch.",
    },
    {
      member: "className",
      reason:
        "React passthrough styling prop is intentionally omitted from the curated public props table.",
    },
    {
      member: "aria-invalid",
      reason:
        "ARIA passthrough is covered by accessibility behavior tests; metadata ownership is outside this batch.",
    },
    {
      member: "children",
      reason:
        "React composition slot is documented in anatomy/examples rather than the curated group props table.",
    },
    {
      member: "ref",
      reason: "React ref passthrough is intentionally omitted from the curated public props table.",
    },
  ],
  "menu:MenuProps": [
    {
      member: "onKeyDown",
      reason:
        "Native event escape hatch is part of the type surface but omitted from the curated public props table.",
    },
  ],
  "radio:RadioGroupProps": [
    {
      member: "onKeyDown",
      reason:
        "Native event escape hatch is part of the type surface but omitted from the curated public props table.",
    },
    {
      member: "disabled",
      reason:
        "Group-level disabled state mirrors item/native behavior; metadata ownership is outside this batch.",
    },
    {
      member: "size",
      reason:
        "Group-level style token duplicates item styling; metadata ownership is outside this batch.",
    },
    {
      member: "variant",
      reason:
        "Group-level style token duplicates item styling; metadata ownership is outside this batch.",
    },
    {
      member: "aria-invalid",
      reason:
        "ARIA passthrough is covered by accessibility behavior tests; metadata ownership is outside this batch.",
    },
    {
      member: "className",
      reason:
        "React passthrough styling prop is intentionally omitted from the curated public props table.",
    },
    {
      member: "children",
      reason:
        "React composition slot is documented in anatomy/examples rather than the curated group props table.",
    },
    {
      member: "ref",
      reason: "React ref passthrough is intentionally omitted from the curated public props table.",
    },
  ],
  "select-content:SelectContentProps": [
    {
      member: "children",
      reason: "Composition is documented in anatomy and examples rather than the curated table.",
    },
    {
      member: "className",
      reason: "Styling passthrough is intentionally omitted from the curated table.",
    },
    {
      member: "onKeyDown",
      reason: "Native event passthrough is intentionally omitted from the curated table.",
    },
    {
      member: "side",
      reason: "Shared floating-position passthrough is documented by the floating panel primitive.",
    },
    {
      member: "align",
      reason: "Shared floating-position passthrough is documented by the floating panel primitive.",
    },
    {
      member: "sideOffset",
      reason: "Shared floating-position passthrough is documented by the floating panel primitive.",
    },
    {
      member: "collisionPadding",
      reason: "Shared floating-position passthrough is documented by the floating panel primitive.",
    },
    {
      member: "portalContainer",
      reason:
        "Advanced portal ownership is documented in composition guidance rather than this table.",
    },
    {
      member: "ref",
      reason: "React ref passthrough is intentionally omitted from the curated table.",
    },
  ],
  "select-search:SelectSearchProps": [
    {
      member: "className",
      reason: "Styling passthrough is intentionally omitted from the curated table.",
    },
  ],
  "select-value:SelectValueProps": [
    {
      member: "className",
      reason: "Styling passthrough is intentionally omitted from the curated table.",
    },
  ],
};

function readSource(relativePath: string): ts.SourceFile {
  const fileName = resolve(root, relativePath);
  const source = readFileSync(fileName, "utf8");
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function jsDocDescription(node: ts.Node): string {
  const doc = ts
    .getJSDocCommentsAndTags(node)
    .find((entry): entry is ts.JSDoc => entry.kind === ts.SyntaxKind.JSDocComment);

  if (!doc) return "";
  if (typeof doc.comment === "string") return doc.comment.trim();
  if (Array.isArray(doc.comment)) {
    return doc.comment
      .map((part) => part.text)
      .join("")
      .trim();
  }
  return "";
}

function getInterfaceMemberDocs(source: ts.SourceFile, interfaceName: string): Map<string, string> {
  const docs = new Map<string, string>();

  source.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      collectMemberDocs(source, node.members, docs);
      return;
    }

    if (ts.isTypeAliasDeclaration(node) && node.name.text === interfaceName) {
      collectTypeMemberDocs(source, node.type, docs);
    }
  });

  return docs;
}

function getInterfaceMember(
  source: ts.SourceFile,
  interfaceName: string,
  memberName: string,
): ts.PropertySignature | ts.MethodSignature | undefined {
  let match: ts.PropertySignature | ts.MethodSignature | undefined;

  source.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node) || node.name.text !== interfaceName) return;
    match = node.members.find(
      (member): member is ts.PropertySignature | ts.MethodSignature =>
        (ts.isPropertySignature(member) || ts.isMethodSignature(member)) &&
        normalizeMemberName(member.name.getText(source)) === memberName,
    );
  });

  return match;
}

function normalizeMemberName(name: string): string {
  return name.replace(/^["']|["']$/g, "");
}

function collectMemberDocs(
  source: ts.SourceFile,
  members: ts.NodeArray<ts.TypeElement>,
  docs: Map<string, string>,
): void {
  for (const member of members) {
    if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) continue;
    docs.set(normalizeMemberName(member.name.getText(source)), jsDocDescription(member));
  }
}

function collectTypeMemberDocs(
  source: ts.SourceFile,
  node: ts.TypeNode,
  docs: Map<string, string>,
): void {
  if (ts.isTypeLiteralNode(node)) {
    collectMemberDocs(source, node.members, docs);
    return;
  }

  if (ts.isIntersectionTypeNode(node)) {
    for (const type of node.types) collectTypeMemberDocs(source, type, docs);
  }
}

function getFunctionDoc(source: ts.SourceFile, functionName: string): string {
  let description = "";

  source.forEachChild((node) => {
    if (!ts.isFunctionDeclaration(node) || node.name?.text !== functionName) return;
    description = jsDocDescription(node);
  });

  return description;
}

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

describe("component metadata JSDoc sync", () => {
  it("documents every exported component JSDoc member or records a justified exclusion", () => {
    const failures: string[] = [];

    for (const item of componentCases) {
      const source = readSource(item.sourcePath);

      expectMetadataDocumentsJSDocMembers({
        caseName: item.name,
        typeName: item.propsType,
        sourceDocs: getInterfaceMemberDocs(source, item.propsType),
        metadataNames: new Set(
          metadataFields(
            Object.entries(item.doc.props?.[item.partName] ?? {}).map(([name, value]) => ({
              name,
              description: value.description,
            })),
          ),
        ),
        failures,
      });
    }

    expect(failures).toEqual([]);
  });

  it("backs documented component props with exported JSDoc", () => {
    const failures: string[] = [];

    for (const item of componentCases) {
      const source = readSource(item.sourcePath);
      const docs = getInterfaceMemberDocs(source, item.propsType);
      const fields = metadataFields(
        Object.entries(item.doc.props?.[item.partName] ?? {}).map(([name, value]) => ({
          name,
          description: value.description,
        })),
      );

      for (const field of fields) {
        if (!docs.get(field)) failures.push(`${item.name}: ${item.propsType}.${field}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("keeps Select output and accessible-name controls aligned with source props", () => {
    for (const item of requiredSelectMetadataCases) {
      const source = readSource(item.sourcePath);
      const publicMetadata: Record<string, PropMetadata> = selectDoc.props?.[item.partName] ?? {};

      for (const [memberName, expected] of Object.entries(item.members)) {
        const sourceMember = getInterfaceMember(source, item.propsType, memberName);
        expect(
          sourceMember,
          `${item.propsType}.${memberName} is missing from source`,
        ).toBeDefined();
        if (!sourceMember) continue;

        expect(
          sourceMember.questionToken,
          `${item.propsType}.${memberName} must stay optional`,
        ).toBeDefined();
        expect(sourceMember.type?.getText(source)).toBe(expected.type);
        expect(jsDocDescription(sourceMember).trim()).not.toBe("");

        const metadata = publicMetadata[memberName];
        expect(
          metadata,
          `${item.partName}.${memberName} is missing from public metadata`,
        ).toBeDefined();
        expect(metadata).toMatchObject({
          type: expected.type,
          required: false,
          defaultValue: expected.defaultValue,
        });
        expect(metadata?.description).toMatch(expected.description);
      }
    }
  });

  it("documents DialogClose accessible-name precedence and fallback", () => {
    expect(dialogDoc.props?.DialogClose?.["aria-label"]).toEqual({
      type: "string",
      required: false,
      defaultValue: null,
      description:
        'Explicit accessible name. aria-labelledby wins when both attributes are set. With neither attribute, visible child text names the button; empty, decorative, or hidden content falls back to "Close dialog".',
    });
    expect(dialogDoc.props?.DialogClose?.["aria-labelledby"]).toEqual({
      type: "string",
      required: false,
      defaultValue: null,
      description:
        'ID reference for an external label. It takes precedence over aria-label and suppresses the automatic "Close dialog" fallback.',
    });
  });
});
