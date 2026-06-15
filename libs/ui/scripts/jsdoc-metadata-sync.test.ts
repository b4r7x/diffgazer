import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { checkboxDoc } from "../registry/component-docs/checkbox";
import { menuDoc } from "../registry/component-docs/menu";
import { radioDoc } from "../registry/component-docs/radio";
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
];

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
});

describe("component metadata JSDoc sync", () => {
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
});
