import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  descriptionsAlign,
  expectMetadataDocumentsJSDocMembers,
  findSourceType,
  getInterfaceMemberDocs,
  type MemberMetadataExclusion,
  readSource,
  root,
  sourceTypeHasMember,
  sourceTypeHasShape,
  sourceTypeMemberFallbacks,
  staleMetadataExclusionKeys,
} from "./support.js";

declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: { eager: true }): Record<string, T>;
  }
}

type PropMetadata = {
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
  description?: string;
};

type ComponentDoc = {
  props?: Record<string, Record<string, PropMetadata>>;
};

type ComponentDocModule = Record<string, unknown>;
const componentDocModules = import.meta.glob<ComponentDocModule>(
  "../../registry/component-docs/*.ts",
  { eager: true },
);

type RegistryItem = {
  name: string;
  type: string;
  meta?: { hidden?: boolean; docsPage?: boolean };
};

const authoredRegistryItems = (
  JSON.parse(readFileSync(resolve(root, "registry/registry.json"), "utf8")) as {
    items: RegistryItem[];
  }
).items;

const publicRegistryItems = (
  JSON.parse(readFileSync(resolve(root, "public/r/registry.json"), "utf8")) as {
    items: RegistryItem[];
  }
).items;

function componentDocExportName(name: string): string {
  return `${name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}Doc`;
}

function getComponentDoc(name: string): ComponentDoc {
  const modulePath = `../../registry/component-docs/${name}.ts`;
  const module = componentDocModules[modulePath];
  const doc = module?.[componentDocExportName(name)];
  if (!doc || typeof doc !== "object") {
    throw new Error(`Missing component doc export for ${name}`);
  }
  return doc as ComponentDoc;
}

function isPublishedComponent(item: RegistryItem): boolean {
  return item.type === "registry:ui" && item.meta?.hidden !== true && item.meta?.docsPage !== false;
}

const publishedComponents = publicRegistryItems.filter(isPublishedComponent);

const publishedComponentNames = (items: RegistryItem[]) =>
  items
    .filter(isPublishedComponent)
    .map((item) => item.name)
    .sort();

const explicitSourceTypes: Record<string, string> = {
  // Tooltip re-exports Popover.Trigger; the published Tooltip source intentionally does not copy
  // that implementation, so this cross-item mapping is part of the registry contract.
  "tooltip:Tooltip.Trigger": "PopoverTriggerProps",
  // NavigationList.Badge re-exports the generic Badge prop contract from the registry item.
  "navigation-list:NavigationList.Badge": "BadgeProps",
  // The imperative toast table documents the options object accepted by toast(), not the callable
  // function type (which has no property JSDoc of its own).
  "toast:toast (function)": "ToastOptions",
  // This public hook's props table is the return/context contract rather than component props.
  "floating-panel:useFloatingPanelContext": "FloatingPanelContextValue",
};

function sourceTypeCandidates(groupName: string, componentName: string): string[] {
  const functionBase = groupName.replace(/\s*\(function\)\s*$/i, "");
  const base = functionBase.replace(/[^A-Za-z0-9]/g, "");
  const candidates = [
    `${base}Props`,
    `${base}Options`,
    `${base}ContextValue`,
    `${base}Return`,
    `${base}Fn`,
  ];
  if (/\(function\)/i.test(groupName)) candidates.unshift(`${componentName}Options`);
  if (/^use.+Context$/.test(base)) candidates.unshift(`${base.slice(3, -7)}ContextValue`);
  return [...new Set(candidates)];
}

type ComponentJsDocCase = {
  name: string;
  docName: string;
  doc: ComponentDoc;
  sourcePath: string;
  partName: string;
  propsType: string;
};

function createComponentCase(
  componentName: string,
  partName: string,
  doc: ComponentDoc,
): ComponentJsDocCase {
  const key = `${componentName}:${partName}`;
  const typeName =
    explicitSourceTypes[key] ??
    sourceTypeCandidates(partName, componentName).find((candidate) => findSourceType(candidate));
  if (!typeName) {
    throw new Error(`No source type mapping for published component props group ${key}`);
  }
  const sourceType = findSourceType(typeName);
  if (!sourceType) {
    throw new Error(`Mapped source type ${typeName} for ${key} does not exist`);
  }
  return {
    name: key,
    docName: componentName,
    doc,
    sourcePath: relative(root, sourceType.sourcePath),
    partName,
    propsType: sourceType.typeName,
  };
}

const componentCases = publishedComponents.flatMap((item) => {
  const doc = getComponentDoc(item.name);
  return Object.keys(doc.props ?? {}).map((partName) =>
    createComponentCase(item.name, partName, doc),
  );
});

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
const SHARED_BUTTON_PROP =
  "Shared Button styling/interaction prop is documented on Button and omitted from this action-focused table.";

const documentedMemberExclusions: Record<string, MemberMetadataExclusion[]> = {
  "accordion:AccordionProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "aria-label", reason: ARIA_PASSTHROUGH },
    { member: "aria-labelledby", reason: ARIA_PASSTHROUGH },
    { member: "ref", reason: REF_PASSTHROUGH },
    { member: "onKeyDown", reason: NATIVE_EVENT_ESCAPE_HATCH },
  ],
  "button:ButtonProps": [
    { member: "ref", reason: REF_PASSTHROUGH },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "callout:CalloutProps": [{ member: "children", reason: COMPOSITION_SLOT }],
  "command-palette:CommandPaletteProps": [{ member: "children", reason: COMPOSITION_SLOT }],
  "dialog:DialogProps": [{ member: "children", reason: COMPOSITION_SLOT }],
  "icons:ChevronProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "input:InputProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "navigation-list:NavigationListProps": [
    { member: "onKeyDown", reason: NATIVE_EVENT_ESCAPE_HATCH },
  ],
  "radio:RadioProps": [
    {
      member: "isTabTarget",
      reason: "Roving-focus implementation detail is not part of the curated public props table.",
    },
    {
      member: "highlighted",
      reason: "Roving-focus implementation detail is not part of the curated public props table.",
    },
    { member: "aria-label", reason: ARIA_PASSTHROUGH },
    { member: "aria-labelledby", reason: ARIA_PASSTHROUGH },
    { member: "aria-describedby", reason: ARIA_PASSTHROUGH },
    { member: "aria-invalid", reason: ARIA_PASSTHROUGH },
    { member: "onNativeInvalid", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "ref", reason: REF_PASSTHROUGH },
    {
      member: "data-value",
      reason: "DOM state emitted by the group primitive is documented as an attribute contract.",
    },
  ],
  "radio:RadioGroupItemProps": [
    { member: "aria-label", reason: ARIA_PASSTHROUGH },
    { member: "aria-labelledby", reason: ARIA_PASSTHROUGH },
    { member: "aria-describedby", reason: ARIA_PASSTHROUGH },
    { member: "aria-invalid", reason: ARIA_PASSTHROUGH },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "search-input:SearchInputProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "tabs:TabsProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "textarea:TextareaProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "toggle-group:ToggleGroupProps": [
    { member: "onKeyDown", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "checkbox:CheckboxGroupProps": [
    { member: "onKeyDown", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "size", reason: GROUP_STYLE_TOKEN },
    { member: "variant", reason: GROUP_STYLE_TOKEN },
    { member: "strikethrough", reason: GROUP_STYLE_TOKEN },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "aria-invalid", reason: ARIA_PASSTHROUGH },
    { member: "children", reason: COMPOSITION_SLOT },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "menu:MenuProps": [{ member: "onKeyDown", reason: NATIVE_EVENT_ESCAPE_HATCH }],
  "radio:RadioGroupProps": [
    { member: "onKeyDown", reason: NATIVE_EVENT_ESCAPE_HATCH },
    {
      member: "disabled",
      reason:
        "Group-level disabled state mirrors item/native behavior; documented on the item props table.",
    },
    { member: "size", reason: GROUP_STYLE_TOKEN },
    { member: "variant", reason: GROUP_STYLE_TOKEN },
    { member: "aria-invalid", reason: ARIA_PASSTHROUGH },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "children", reason: COMPOSITION_SLOT },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "select:SelectContentProps": [
    {
      member: "children",
      reason: "Composition is documented in anatomy and examples rather than the curated table.",
    },
    { member: "className", reason: CURATED_TABLE_STYLING_PASSTHROUGH },
    {
      member: "onKeyDown",
      reason: "Native event passthrough is intentionally omitted from the curated table.",
    },
    { member: "side", reason: FLOATING_POSITION_PASSTHROUGH },
    { member: "align", reason: FLOATING_POSITION_PASSTHROUGH },
    { member: "sideOffset", reason: FLOATING_POSITION_PASSTHROUGH },
    { member: "collisionPadding", reason: FLOATING_POSITION_PASSTHROUGH },
    {
      member: "portalContainer",
      reason:
        "Advanced portal ownership is documented in composition guidance rather than this table.",
    },
    { member: "ref", reason: CURATED_TABLE_REF_PASSTHROUGH },
  ],
  "select:SelectSearchProps": [{ member: "className", reason: CURATED_TABLE_STYLING_PASSTHROUGH }],
  "select:SelectValueProps": [{ member: "className", reason: CURATED_TABLE_STYLING_PASSTHROUGH }],
  "accordion:AccordionItemProps": [{ member: "className", reason: CLASSNAME_PASSTHROUGH }],
  "accordion:AccordionHeaderProps": [{ member: "className", reason: CLASSNAME_PASSTHROUGH }],
  "accordion:AccordionContentProps": [{ member: "className", reason: CLASSNAME_PASSTHROUGH }],
  "avatar:AvatarImageProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "avatar:AvatarFallbackProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    {
      member: "decorative",
      reason: "Decorative accessibility mode is covered by the Avatar docs and behavior tests.",
    },
  ],
  "input:InputGroupProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "tooltip:PopoverTriggerProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "dialog:DialogTriggerProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "onClick", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "dialog:DialogActionProps": [
    { member: "children", reason: COMPOSITION_SLOT },
    { member: "onFocus", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "ref", reason: REF_PASSTHROUGH },
    { member: "autoFocus", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "variant", reason: SHARED_BUTTON_PROP },
    { member: "size", reason: SHARED_BUTTON_PROP },
    { member: "bracket", reason: SHARED_BUTTON_PROP },
    { member: "loading", reason: SHARED_BUTTON_PROP },
    { member: "disabled", reason: SHARED_BUTTON_PROP },
    { member: "highlighted", reason: SHARED_BUTTON_PROP },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "dialog:DialogCloseProps": [
    { member: "children", reason: COMPOSITION_SLOT },
    { member: "onFocus", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "ref", reason: REF_PASSTHROUGH },
    { member: "autoFocus", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "variant", reason: SHARED_BUTTON_PROP },
    { member: "size", reason: SHARED_BUTTON_PROP },
    { member: "bracket", reason: SHARED_BUTTON_PROP },
    { member: "disabled", reason: SHARED_BUTTON_PROP },
    { member: "highlighted", reason: SHARED_BUTTON_PROP },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "dialog:DialogCloseIconProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "dialog:DialogFooterProps": [{ member: "children", reason: COMPOSITION_SLOT }],
  "tabs:TabsTriggerProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "menu:MenuItemProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "menu:MenuGroupProps": [{ member: "className", reason: CLASSNAME_PASSTHROUGH }],
  "menu:MenuLabelProps": [
    {
      member: "id",
      reason: "The generated label id is an ARIA wiring detail, not a curated prop.",
    },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "menu:MenuItemCheckboxProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "menu:MenuItemRadioProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "menu:MenuSubTriggerProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "menu:MenuSubContentProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "aria-label", reason: ARIA_PASSTHROUGH },
    { member: "aria-labelledby", reason: ARIA_PASSTHROUGH },
  ],
  "navigation-list:NavigationListTitleProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "navigation-list:NavigationListMetaProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "navigation-list:NavigationListSubtitleProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "navigation-list:BadgeProps": [
    {
      member: "appearance",
      reason: "Badge appearance is a generic primitive option, not a NavigationList-specific prop.",
    },
    {
      member: "dot",
      reason: "Badge dot mode is a generic primitive option, not a NavigationList-specific prop.",
    },
  ],
  "navigation-list:NavigationListGroupProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "navigation-list:NavigationListProgressProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "stepper:StepperStepProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "code-block:CodeBlockCopyButtonProps": [{ member: "children", reason: COMPOSITION_SLOT }],
  "command-palette:CommandPaletteContentProps": [
    { member: "children", reason: COMPOSITION_SLOT },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "command-palette:CommandPaletteItemProps": [{ member: "children", reason: COMPOSITION_SLOT }],
  "command-palette:CommandPaletteGroupProps": [{ member: "children", reason: COMPOSITION_SLOT }],
  "command-palette:CommandPaletteInputProps": [
    { member: "onKeyDown", reason: NATIVE_EVENT_ESCAPE_HATCH },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "select:SelectTagsProps": [{ member: "className", reason: CURATED_TABLE_STYLING_PASSTHROUGH }],
  "select:SelectItemProps": [{ member: "children", reason: COMPOSITION_SLOT }],
  "select:SelectEmptyProps": [{ member: "className", reason: CURATED_TABLE_STYLING_PASSTHROUGH }],
  "sidebar:SidebarTriggerProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "sidebar:SidebarSectionTitleProps": [
    { member: "ref", reason: REF_PASSTHROUGH },
    { member: "onClick", reason: NATIVE_EVENT_ESCAPE_HATCH },
  ],
  "sidebar:SidebarItemProps": [
    { member: "ref", reason: REF_PASSTHROUGH },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "breadcrumbs:BreadcrumbsLinkProps": [{ member: "ref", reason: REF_PASSTHROUGH }],
  "popover:PopoverTriggerProps": [
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "popover:PopoverContentProps": [
    { member: "aria-label", reason: ARIA_PASSTHROUGH },
    { member: "aria-labelledby", reason: ARIA_PASSTHROUGH },
    { member: "data-slot", reason: "The data-slot marker is a DOM contract, not a curated prop." },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "tooltip:TooltipContentProps": [
    { member: "aria-label", reason: ARIA_PASSTHROUGH },
    { member: "aria-labelledby", reason: ARIA_PASSTHROUGH },
    { member: "data-slot", reason: "The data-slot marker is a DOM contract, not a curated prop." },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
  "dialog:DialogContentProps": [
    { member: "children", reason: COMPOSITION_SLOT },
    { member: "className", reason: CLASSNAME_PASSTHROUGH },
  ],
  "select:SelectProps": [
    { member: "aria-invalid", reason: ARIA_PASSTHROUGH },
    { member: "aria-describedby", reason: ARIA_PASSTHROUGH },
    { member: "aria-labelledby", reason: ARIA_PASSTHROUGH },
    { member: "children", reason: COMPOSITION_SLOT },
    { member: "ref", reason: REF_PASSTHROUGH },
  ],
};

const SOURCE_DOC_GAP =
  "Published metadata documents this derived or native member; its source type has no local JSDoc to compare.";

const metadataOnlyMembers: Record<string, string[]> = {
  "accordion:AccordionTriggerProps": ["variant"],
  "avatar:AvatarProps": ["size"],
  "avatar:AvatarImageProps": ["src"],
  "avatar:AvatarGroupProps": ["aria-label", "children"],
  "avatar:AvatarIndicatorProps": ["size"],
  "badge:BadgeProps": ["children"],
  "input:InputProps": ["aria-invalid"],
  "field:FieldLabelProps": ["htmlFor", "id"],
  "field:FieldDescriptionProps": ["children"],
  "field:FieldErrorProps": ["children"],
  "textarea:TextareaProps": ["size", "aria-invalid"],
  "checkbox:CheckboxProps": [
    "checked",
    "defaultChecked",
    "onChange",
    "value",
    "name",
    "required",
    "label",
    "description",
    "disabled",
    "size",
    "variant",
    "strikethrough",
  ],
  "checkbox:CheckboxItemProps": ["value", "label", "description", "disabled"],
  "icons:ChevronProps": ["size"],
  "panel:PanelProps": ["as", "children"],
  "panel:PanelHeaderProps": ["children"],
  "panel:PanelTitleProps": ["children"],
  "panel:PanelDescriptionProps": ["children"],
  "panel:PanelContentProps": ["spacing", "children"],
  "panel:PanelFooterProps": ["children"],
  "panel:PanelLabelProps": ["variant", "children"],
  "status-indicator:StatusIndicatorProps": ["children", "className"],
  "scroll-area:ScrollAreaProps": ["children"],
  "card:CardProps": ["as", "surface", "interactive", "size", "children"],
  "card:CardLabelProps": ["variant", "children"],
  "card:CardTitleProps": ["as", "children"],
  "card:CardDescriptionProps": ["children"],
  "card:CardHeaderProps": ["children"],
  "card:CardActionProps": ["children"],
  "card:CardContentProps": ["children"],
  "card:CardFooterProps": ["children"],
  "block-bar:BlockBarSegmentProps": ["variant"],
  "section-header:SectionHeaderProps": ["variant", "bordered", "children"],
  "empty-state:EmptyStateProps": ["variant", "size", "children"],
  "empty-state:EmptyStateIconProps": ["children"],
  "empty-state:EmptyStateMessageProps": ["children"],
  "empty-state:EmptyStateDescriptionProps": ["children"],
  "empty-state:EmptyStateActionsProps": ["children"],
  "empty-state:EmptyStateHintProps": ["children"],
  "key-value:KeyValueItemProps": ["className"],
  "label:LabelProps": ["children"],
  "dialog:DialogContentProps": ["size", "frame"],
  "kbd:KbdProps": ["size", "variant", "children"],
  "kbd:KbdGroupProps": ["children"],
  "divider:DividerProps": ["variant", "children"],
  "tabs:TabsProps": ["children"],
  "tabs:TabsListProps": ["children"],
  "tabs:TabsTriggerProps": ["children"],
  "tabs:TabsContentProps": ["children"],
  "navigation-list:NavigationListProps": ["aria-label"],
  "navigation-list:NavigationListStatusProps": ["className"],
  "navigation-list:BadgeProps": ["children"],
  "search-input:SearchInputProps": ["placeholder", "aria-label", "aria-invalid", "disabled"],
  "code-block:CodeBlockHeaderProps": ["children"],
  "code-block:CodeBlockLabelProps": ["children"],
  "code-block:CodeBlockContentProps": ["children"],
  "stepper:StepperSubstepProps": ["tag", "detail"],
  "sidebar:SidebarItemProps": ["intent"],
  "horizontal-stepper:HorizontalStepperProps": ["aria-label", "className"],
  "command-palette:CommandPaletteContentProps": ["size"],
  "select:SelectTriggerProps": ["aria-label", "aria-labelledby"],
  "sidebar:SidebarTriggerProps": ["aria-label", "children"],
  "sidebar:SidebarHeaderProps": ["children"],
  "sidebar:SidebarContentProps": ["children"],
  "sidebar:SidebarSectionProps": ["children"],
  "sidebar:SidebarSectionTitleProps": ["children"],
  "sidebar:SidebarSectionContentProps": ["children"],
  "sidebar:SidebarItemLabelProps": ["children"],
  "sidebar:SidebarItemBadgeProps": ["children"],
  "sidebar:SidebarFooterProps": ["children"],
  "pager:PagerProps": ["children"],
  "pager:PagerLinkProps": ["href"],
  "breadcrumbs:BreadcrumbsProps": ["children"],
  "breadcrumbs:BreadcrumbsItemProps": ["children"],
  "breadcrumbs:BreadcrumbsLinkProps": ["href"],
  "breadcrumbs:BreadcrumbsEllipsisProps": ["children"],
  "toc:TocProps": ["children"],
  "toc:TocListProps": ["children"],
  "toc:TocItemProps": ["href"],
  "typography:TypographyProps": [
    "as",
    "variant",
    "size",
    "weight",
    "color",
    "lineClamp",
    "truncate",
    "children",
  ],
  "floating-panel:FloatingPanelProps": ["className"],
  "switch:SwitchProps": [
    "form",
    "checked",
    "defaultChecked",
    "onChange",
    "value",
    "name",
    "required",
    "disabled",
    "size",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
    "aria-invalid",
  ],
  "diff-view:DiffViewProps": ["className", "ref"],
  "skeleton:SkeletonProps": ["className"],
};

const metadataOnlyExclusions: Record<string, MemberMetadataExclusion[]> = Object.fromEntries(
  Object.entries(metadataOnlyMembers).map(([key, members]) => [
    key,
    members.map((member) => ({ member, reason: SOURCE_DOC_GAP })),
  ]),
);

const COMPONENT_DOCS_DIR = resolve(root, "registry/component-docs");
const COMPONENT_DOC_SUPPORT_FILES = new Set(["types.ts"]);

function componentDocNames(): string[] {
  return readdirSync(COMPONENT_DOCS_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        !COMPONENT_DOC_SUPPORT_FILES.has(entry.name),
    )
    .map((entry) => entry.name.slice(0, -3));
}

function metadataFor(item: ComponentJsDocCase): Map<string, string> {
  return new Map(
    Object.entries(item.doc.props?.[item.partName] ?? []).map(([name, value]) => [
      name,
      value.description?.trim() ?? "",
    ]),
  );
}

describe("component metadata JSDoc sync", () => {
  it("keeps the authored and committed public UI inventories aligned", () => {
    expect(publishedComponentNames(publicRegistryItems)).toEqual(
      publishedComponentNames(authoredRegistryItems),
    );
  });

  it("derives and enrolls every published component props group", () => {
    expect(publishedComponents.map((item) => item.name).sort()).toEqual(componentDocNames().sort());
    expect(componentCases).toHaveLength(165);
    expect(new Set(componentCases.map((item) => item.name)).size).toBe(165);
  });

  it("maps every enrolled group to a real source type", () => {
    const failures = componentCases.flatMap((item) => {
      const source = readSource(item.sourcePath);
      const metadata = metadataFor(item);
      return item.propsType && sourceTypeHasShape(source, item.propsType) && metadata.size > 0
        ? []
        : [`${item.name}: ${item.propsType} is missing or vacuous`];
    });
    expect(failures).toEqual([]);
  });

  it("keeps every current metadata-only member explicitly accounted for", () => {
    const members = Object.values(metadataOnlyMembers).flat();
    expect(members).toHaveLength(146);
    expect(members.every((member) => member.trim())).toBe(true);
    expect(Object.values(metadataOnlyExclusions).flat()).toHaveLength(members.length);
  });

  it("follows local members and imported heritage when collecting source JSDoc", () => {
    const docs = getInterfaceMemberDocs(
      readSource("registry/ui/dialog/dialog-action.tsx"),
      "DialogActionProps",
    );

    expect(docs.get("variant")).toBe("Visual style of the button.");
    expect(docs.get("children")).toBe("Content rendered inside the component.");
  });

  it("documents every exported component JSDoc member or records a justified exclusion", () => {
    const failures: string[] = [];
    const enrolledKeys = new Set(componentCases.map((item) => `${item.docName}:${item.propsType}`));
    failures.push(...staleMetadataExclusionKeys(documentedMemberExclusions, enrolledKeys));
    failures.push(...staleMetadataExclusionKeys(metadataOnlyExclusions, enrolledKeys));

    for (const item of componentCases) {
      const source = readSource(item.sourcePath);
      const sourceDocs = getInterfaceMemberDocs(source, item.propsType);
      const metadata = metadataFor(item);
      for (const [name, description] of metadata) {
        if (!description) failures.push(`${item.name}: ${name}: missing metadata description`);
      }
      expectMetadataDocumentsJSDocMembers({
        caseName: item.docName,
        typeName: item.propsType,
        sourceDocs,
        metadataNames: new Set(metadata.keys()),
        metadataDescriptions: metadata,
        exclusions: documentedMemberExclusions,
        metadataExclusions: metadataOnlyExclusions,
        sourceTypeMemberExists: (memberName) =>
          sourceTypeHasMember(source, item.propsType, memberName),
        failures,
      });
    }

    for (const pair of sourceTypeMemberFallbacks) {
      failures.push(
        `${pair}: type could not be bound, so member existence proves only a JSDoc tag`,
      );
    }

    expect(failures).toEqual([]);
  });

  it("rejects stale whole-table exclusion keys", () => {
    expect(
      staleMetadataExclusionKeys(
        { "missing:Props": [{ member: "staleMember", reason: "must never be accepted" }] },
        new Set(["button:ButtonProps"]),
      ),
    ).toEqual(["missing:Props: stale exclusion key"]);
    expect(
      staleMetadataExclusionKeys(
        { "missing:Props": [{ member: "label", reason: "must never be accepted" }] },
        new Set(["button:ButtonProps"]),
      ),
    ).toEqual(["missing:Props: stale exclusion key"]);
  });

  it("rejects stale member exclusions", () => {
    const failures: string[] = [];

    expectMetadataDocumentsJSDocMembers({
      caseName: "button",
      typeName: "ButtonProps",
      sourceDocs: new Map([["label", "Accessible label."]]),
      metadataNames: new Set(["label"]),
      exclusions: {
        "button:ButtonProps": [{ member: "removed", reason: "No longer public." }],
      },
      failures,
    });

    expect(failures).toEqual(["button:ButtonProps.removed: stale"]);
  });

  it("rejects exclusion entries without a rationale", () => {
    const failures: string[] = [];

    expectMetadataDocumentsJSDocMembers({
      caseName: "button",
      typeName: "ButtonProps",
      sourceDocs: new Map([
        ["label", "Accessible label."],
        ["className", "Additional class names."],
      ]),
      metadataNames: new Set(["label"]),
      exclusions: {
        "button:ButtonProps": [{ member: "className", reason: "  " }],
      },
      failures,
    });

    expect(failures).toEqual(["button:ButtonProps.className: missing rationale"]);
  });

  it("rejects metadata-only members without an exact written exception", () => {
    const failures: string[] = [];

    expectMetadataDocumentsJSDocMembers({
      caseName: "button",
      typeName: "ButtonProps",
      sourceDocs: new Map([["label", "Accessible label."]]),
      metadataNames: new Set(["label", "missing"]),
      metadataDescriptions: new Map([
        ["label", "Accessible label."],
        ["missing", "Unbacked metadata."],
      ]),
      exclusions: {},
      failures,
    });

    expect(failures).toContain("button: ButtonProps.missing: metadata-only member");
  });

  it("rejects metadata-only exceptions once source JSDoc exists", () => {
    const failures: string[] = [];

    expectMetadataDocumentsJSDocMembers({
      caseName: "button",
      typeName: "ButtonProps",
      sourceDocs: new Map([["label", "Accessible label."]]),
      metadataNames: new Set(["label"]),
      metadataDescriptions: new Map([["label", "Accessible label."]]),
      exclusions: {},
      metadataExclusions: {
        "button:ButtonProps": [{ member: "label", reason: "No local JSDoc." }],
      },
      failures,
    });

    expect(failures).toContain("button:ButtonProps.label: stale metadata exclusion");
  });

  it("rejects metadata-only exceptions when the resolved source member disappears", () => {
    const failures: string[] = [];

    expectMetadataDocumentsJSDocMembers({
      caseName: "button",
      typeName: "ButtonProps",
      sourceDocs: new Map(),
      metadataNames: new Set(["nativeProp"]),
      metadataDescriptions: new Map([["nativeProp", "Native prop."]]),
      exclusions: {},
      metadataExclusions: {
        "button:ButtonProps": [{ member: "nativeProp", reason: "Native source member." }],
      },
      sourceTypeMemberExists: () => false,
      failures,
    });

    expect(failures).toContain("button:ButtonProps.nativeProp: stale metadata exclusion");
  });

  it("compares normalized descriptions instead of checking names only", () => {
    expect(
      descriptionsAlign("Accessible name for the image.", "Accessible name for the image.\n"),
    ).toBe(true);
    expect(descriptionsAlign("Accessible name for the image.", "Unrelated image value.")).toBe(
      false,
    );
    expect(descriptionsAlign("Accessible name for the image.", "Completely unrelated value.")).toBe(
      false,
    );
    expect(descriptionsAlign("Disables interaction.", "Enables interaction.")).toBe(false);
    expect(descriptionsAlign("Sets the value.", "Clears the value.")).toBe(false);
    expect(descriptionsAlign("Stops the handler.", "Calls the handler.")).toBe(false);
    expect(descriptionsAlign("Accessible label.", "Removes the label.")).toBe(false);
  });
});
