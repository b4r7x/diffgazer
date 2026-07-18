import type { HookDoc } from "@diffgazer/registry";

export const listboxDoc: HookDoc = {
  description:
    "Shared listbox state and keyboard navigation hook. Manages selection, highlight, and container ARIA props for listbox-pattern components like menu and navigation-list.",
  usage: {
    code: `const items = [
  { id: "apple", label: "Apple" },
  { id: "banana", label: "Banana" },
];

const { selectedId, highlighted, handleItemActivate, getContainerProps } =
  useListbox({
    idPrefix: "my-list",
    items: items.map((item) => ({ id: item.id })),
    onSelect: (id) => console.log("selected", id),
  });

return (
  <div {...getContainerProps()} aria-label="Fruit choices">
    {items.map((item) => (
      <div
        key={item.id}
        id={\`my-list-\${item.id}\`}
        role="option"
        data-value={item.id}
        aria-selected={selectedId === item.id}
        onClick={() => handleItemActivate(item.id)}
      >
        {item.label}
      </div>
    ))}
  </div>
);`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "idPrefix",
      type: "string",
      required: true,
      description:
        'Prefix for generating aria-activedescendant IDs. By default, each option uses id="${idPrefix}-${encodeURIComponent(itemId)}" via getEncodedListboxItemId; pass getItemId to use a different encoding.',
    },
    {
      name: "autoFocus",
      type: "boolean",
      required: false,
      defaultValue: "false",
      description:
        "Focus the container on mount and initialize highlight to the selected item or first navigable item for the active role.",
    },
    {
      name: "selectedId",
      type: "string | null",
      required: false,
      description:
        "Controlled selected item ID. When provided, the hook is in controlled mode for selection.",
    },
    {
      name: "defaultSelectedId",
      type: "string | null",
      required: false,
      defaultValue: "null",
      description: "Initial selected item ID for uncontrolled mode.",
    },
    {
      name: "highlighted",
      type: "string | null",
      required: false,
      description:
        "Controlled highlighted item ID. When provided, the hook is in controlled mode for highlight.",
    },
    {
      name: "defaultHighlighted",
      type: "string | null",
      required: false,
      defaultValue: "null",
      description: "Initial highlighted item ID for uncontrolled mode.",
    },
    {
      name: "onSelect",
      type: "(id: string) => void",
      required: false,
      description: "Called when the selected item changes.",
    },
    {
      name: "onEnter",
      type: "(id: string, event: KeyboardEvent) => void",
      required: false,
      description:
        "Called when Enter activates the highlighted item. Selection is committed before this callback runs.",
    },
    {
      name: "onHighlightChange",
      type: "(id: string | null) => void",
      required: false,
      description:
        "Called when the highlighted item changes via keyboard navigation or is cleared.",
    },
    {
      name: "onNavigationBoundaryReached",
      type: '(direction: "previous" | "next", event: KeyboardEvent, key: string) => void',
      required: false,
      description:
        "Called when wrap is false and keyboard navigation attempts to move before the first item or after the last item. Receives the direction, the originating keyboard event, and the key that hit the boundary.",
    },
    {
      name: "wrap",
      type: "boolean",
      required: false,
      defaultValue: "true",
      description: "Whether keyboard navigation wraps from last item to first (and vice versa).",
    },
    {
      name: "onKeyDown",
      type: "(event: KeyboardEvent) => void",
      required: false,
      description:
        "Additional keydown handler called before the built-in navigation handler. Call event.preventDefault() to suppress default keyboard navigation.",
    },
    {
      name: "role",
      type: '"listbox" | "menu"',
      required: false,
      defaultValue: '"listbox"',
      description: "ARIA role for the container element.",
    },
    {
      name: "itemRole",
      type: '"option" | "menuitem" | "menuitemradio"',
      required: false,
      defaultValue: '"option"',
      description: "ARIA role for each item element.",
    },
    {
      name: "typeahead",
      type: "boolean",
      required: false,
      defaultValue: "false",
      description: "Enable type-ahead character search to jump to matching items.",
    },
    {
      name: "items",
      type: "ListboxMetadataItem[]",
      required: false,
      description:
        "Optional metadata array describing each item ({ id, disabled? }). It helps validate active descendants and initial highlight, while keyboard navigation and typeahead still inspect the mounted DOM items.",
    },
    {
      name: "getItemId",
      type: "(idPrefix: string, id: string) => string",
      required: false,
      defaultValue: "getEncodedListboxItemId",
      description:
        "Override how option DOM ids are derived from idPrefix and the item's logical id. Defaults to URL-encoding the id; supply a custom encoder if your option ids must follow a different scheme (e.g. when consuming externally indexed nodes).",
    },
    {
      name: "ref",
      type: "Ref<HTMLDivElement>",
      required: false,
      description:
        "External/forwarded ref for the container. Composed once with the internal ref so getContainerProps returns a stable ref callback (pass a stable ref, e.g. from useComposedRefs, to avoid detach/re-attach).",
    },
  ],
  returns: {
    type: "UseListboxReturn",
    description:
      "Object with selection state, highlight state, event handlers, and a prop-getter for the container element.",
    properties: [
      {
        name: "selectedId",
        type: "string | null",
        required: true,
        description: "Currently selected item ID.",
      },
      {
        name: "highlighted",
        type: "string | null",
        required: true,
        description: "Currently highlighted (focused) item ID.",
      },
      {
        name: "handleItemActivate",
        type: "(id: string) => void",
        required: true,
        description: "Call on item click or Enter/Space to select and activate it.",
      },
      {
        name: "handleItemHighlight",
        type: "(id: string) => void",
        required: true,
        description: "Call on item hover/focus to highlight it.",
      },
      {
        name: "getContainerProps",
        type: "() => ContainerProps",
        required: true,
        description:
          "Prop-getter for the listbox container. Returns ref, role, tabIndex, aria-activedescendant, and onKeyDown. The ref composes the internal ref with the `ref` option passed to useListbox.",
      },
    ],
  },
  notes: [
    {
      title: "Keyboard Navigation",
      content:
        'Arrow keys move highlight through items with role="option" inside the container. Enter and Space select the highlighted item. Navigation uses @diffgazer/keys\'s useNavigation internally.',
    },
    {
      title: "Controlled & Uncontrolled",
      content:
        "Both selection and highlight support controlled and uncontrolled modes via useControllableState. Pass selectedId/highlighted for controlled, or use defaultSelectedId/defaultHighlighted for uncontrolled.",
    },
    {
      title: "Used By",
      content:
        "Built into menu and navigation-list components. Provides the shared listbox interaction pattern so each component only needs to handle its own rendering.",
    },
  ],
  examples: [{ name: "listbox-basic", title: "Basic Listbox" }],
  tags: ["hook", "listbox", "navigation", "selection", "keyboard", "aria"],
};
