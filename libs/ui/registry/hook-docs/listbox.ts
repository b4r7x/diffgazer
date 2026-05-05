import type { HookDoc } from "@diffgazer/registry"

export const listboxDoc: HookDoc = {
  description:
    "Shared listbox state and keyboard navigation hook. Manages selection, highlight, and container ARIA props for listbox-pattern components like menu and navigation-list.",
  usage: {
    code: `const { selectedId, highlightedId, handleItemActivate, getContainerProps } =
  useListbox({
    idPrefix: "my-list",
    onSelect: (id) => console.log("selected", id),
  });

return (
  <div {...getContainerProps()}>
    {items.map((item) => (
      <div
        key={item.id}
        id={\`my-list-\${item.id}\`}
        role="option"
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
        "Prefix for generating aria-activedescendant IDs. Each option should have id=\"{idPrefix}-{itemId}\".",
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
      name: "highlightedId",
      type: "string | null",
      required: false,
      description:
        "Controlled highlighted item ID. When provided, the hook is in controlled mode for highlight.",
    },
    {
      name: "defaultHighlightedId",
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
      name: "onHighlightChange",
      type: "(id: string) => void",
      required: false,
      description: "Called when the highlighted item changes via keyboard navigation.",
    },
    {
      name: "wrap",
      type: "boolean",
      required: false,
      defaultValue: "true",
      description:
        "Whether keyboard navigation wraps from last item to first (and vice versa).",
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
      type: '"option" | "menuitem"',
      required: false,
      defaultValue: '"option"',
      description: "ARIA role for each item element.",
    },
    {
      name: "typeahead",
      type: "boolean",
      required: false,
      defaultValue: "false",
      description:
        "Enable type-ahead character search to jump to matching items.",
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
        name: "highlightedId",
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
        type: "(ref?: Ref<HTMLDivElement>) => ContainerProps",
        required: true,
        description:
          "Prop-getter for the listbox container. Returns ref, role, tabIndex, aria-activedescendant, and onKeyDown. Accepts an optional external ref that is composed with the internal ref.",
      },
    ],
  },
  notes: [
    {
      title: "Keyboard Navigation",
      content:
        "Arrow keys move highlight through items with role=\"option\" inside the container. Enter and Space select the highlighted item. Navigation uses @diffgazer/keys's useNavigation internally.",
    },
    {
      title: "Controlled & Uncontrolled",
      content:
        "Both selection and highlight support controlled and uncontrolled modes via useControllableState. Pass selectedId/highlightedId for controlled, or use defaultSelectedId/defaultHighlightedId for uncontrolled.",
    },
    {
      title: "Used By",
      content:
        "Built into menu and navigation-list components. Provides the shared listbox interaction pattern so each component only needs to handle its own rendering.",
    },
  ],
  examples: [],
  tags: ["hook", "listbox", "navigation", "selection", "keyboard", "aria"],
}
