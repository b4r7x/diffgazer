import { describe, expect, it } from "vitest";
import { selectDoc } from "../../registry/component-docs/select";
import { getInterfaceMember, jsDocDescription, readSource } from "./support";

type PropMetadata = {
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
  description?: string;
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

describe("Select metadata JSDoc sync", () => {
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
});
