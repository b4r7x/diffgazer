import { describe, expect, it } from "vitest";
import { checkboxDoc } from "../../registry/component-docs/checkbox";
import { menuDoc } from "../../registry/component-docs/menu";
import { radioDoc } from "../../registry/component-docs/radio";
import { selectDoc } from "../../registry/component-docs/select";
import { getInterfaceMemberDocs, readSource } from "./support";

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

const documentedMemberExclusions: Record<string, MemberMetadataExclusion[]> = {
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
});
