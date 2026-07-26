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

const NATIVE_EVENT_ESCAPE_HATCH =
  "Native event escape hatch is part of the type surface but omitted from the curated public props table.";
const REF_PASSTHROUGH =
  "React ref passthrough is intentionally omitted from the curated public props table.";
const FLOATING_POSITION_PASSTHROUGH =
  "Shared floating-position passthrough is documented by the floating panel primitive.";
const GROUP_STYLE_TOKEN =
  "Group-level style token duplicates item styling; documented on the item props table.";
const ARIA_PASSTHROUGH =
  "ARIA passthrough is covered by accessibility behavior tests rather than the curated props table.";
const CLASSNAME_PASSTHROUGH =
  "React passthrough styling prop is intentionally omitted from the curated public props table.";
const COMPOSITION_SLOT =
  "React composition slot is documented in anatomy/examples rather than the curated group props table.";
const CURATED_TABLE_STYLING_PASSTHROUGH =
  "Styling passthrough is intentionally omitted from the curated table.";
const CURATED_TABLE_REF_PASSTHROUGH =
  "React ref passthrough is intentionally omitted from the curated table.";

const documentedMemberExclusions: Record<string, MemberMetadataExclusion[]> = {
  "checkbox:CheckboxGroupProps": [
    {
      member: "onKeyDown",
      reason: NATIVE_EVENT_ESCAPE_HATCH,
    },
    {
      member: "size",
      reason: GROUP_STYLE_TOKEN,
    },
    {
      member: "variant",
      reason: GROUP_STYLE_TOKEN,
    },
    {
      member: "strikethrough",
      reason: GROUP_STYLE_TOKEN,
    },
    {
      member: "className",
      reason: CLASSNAME_PASSTHROUGH,
    },
    {
      member: "aria-invalid",
      reason: ARIA_PASSTHROUGH,
    },
    {
      member: "children",
      reason: COMPOSITION_SLOT,
    },
    {
      member: "ref",
      reason: REF_PASSTHROUGH,
    },
  ],
  "menu:MenuProps": [
    {
      member: "onKeyDown",
      reason: NATIVE_EVENT_ESCAPE_HATCH,
    },
  ],
  "radio:RadioGroupProps": [
    {
      member: "onKeyDown",
      reason: NATIVE_EVENT_ESCAPE_HATCH,
    },
    {
      member: "disabled",
      reason:
        "Group-level disabled state mirrors item/native behavior; documented on the item props table.",
    },
    {
      member: "size",
      reason: GROUP_STYLE_TOKEN,
    },
    {
      member: "variant",
      reason: GROUP_STYLE_TOKEN,
    },
    {
      member: "aria-invalid",
      reason: ARIA_PASSTHROUGH,
    },
    {
      member: "className",
      reason: CLASSNAME_PASSTHROUGH,
    },
    {
      member: "children",
      reason: COMPOSITION_SLOT,
    },
    {
      member: "ref",
      reason: REF_PASSTHROUGH,
    },
  ],
  "select-content:SelectContentProps": [
    {
      member: "children",
      reason: "Composition is documented in anatomy and examples rather than the curated table.",
    },
    {
      member: "className",
      reason: CURATED_TABLE_STYLING_PASSTHROUGH,
    },
    {
      member: "onKeyDown",
      reason: "Native event passthrough is intentionally omitted from the curated table.",
    },
    {
      member: "side",
      reason: FLOATING_POSITION_PASSTHROUGH,
    },
    {
      member: "align",
      reason: FLOATING_POSITION_PASSTHROUGH,
    },
    {
      member: "sideOffset",
      reason: FLOATING_POSITION_PASSTHROUGH,
    },
    {
      member: "collisionPadding",
      reason: FLOATING_POSITION_PASSTHROUGH,
    },
    {
      member: "portalContainer",
      reason:
        "Advanced portal ownership is documented in composition guidance rather than this table.",
    },
    {
      member: "ref",
      reason: CURATED_TABLE_REF_PASSTHROUGH,
    },
  ],
  "select-search:SelectSearchProps": [
    {
      member: "className",
      reason: CURATED_TABLE_STYLING_PASSTHROUGH,
    },
  ],
  "select-value:SelectValueProps": [
    {
      member: "className",
      reason: CURATED_TABLE_STYLING_PASSTHROUGH,
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
