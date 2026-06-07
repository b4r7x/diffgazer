import type { ComponentDoc } from "./types";

export const searchInputDoc: ComponentDoc = {
  description:
    "Terminal-styled search input with / prefix and keyboard event callbacks. Supports controlled and uncontrolled modes.",
  notes: [
    {
      title: "Controlled & Uncontrolled",
      content:
        "Pass value + onChange for controlled mode. Pass defaultValue (or nothing) for uncontrolled mode. Works like every other @diffgazer/ui component via useControllableState.",
    },
    {
      title: "Keyboard Callbacks",
      content:
        "SearchInput provides onEscape and onEnter callback props for common search patterns (clear and submit). For arrow-key list navigation, use onKeyDown or @diffgazer/keys's useNavigation hook.",
    },
    {
      title: "Custom Prefix",
      content:
        "The prefix prop replaces the default / character with any ReactNode. Set prefix={null} to hide it entirely.",
    },
    {
      title: "Size Variants",
      content:
        'Pass size="sm", size="md" (default), or size="lg" to control the input and wrapper sizing.',
    },
    {
      title: "Invalid & Disabled",
      content:
        "Set aria-invalid to show destructive border styling. Pass disabled to prevent interaction.",
    },
  ],
  usage: { example: "search-input-default" },
  examples: [
    { name: "search-input-default", title: "Default" },
    { name: "search-input-custom", title: "Custom" },
    { name: "search-input-keyboard", title: "Keyboard Navigation" },
  ],
  keyboard: {
    description:
      "SearchInput provides onEscape and onEnter callback props. For arrow-key navigation in an adjacent list, use the onKeyDown prop or @diffgazer/keys's useNavigation hook. The search-input-keyboard example shows how to wire arrow keys via onKeyDown.",
    examples: [
      { name: "search-input-default", title: "Without keyboard (typing only)" },
      { name: "search-input-keyboard", title: "With keyboard navigation" },
    ],
  },
  props: {
    SearchInput: {
      value: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Controlled search value.",
      },
      defaultValue: {
        type: "string",
        required: false,
        defaultValue: '""',
        description: "Initial search value for uncontrolled usage.",
      },
      onChange: {
        type: "(value: string) => void",
        required: false,
        defaultValue: null,
        description: "Called with the next search value when the native input changes.",
      },
      onEscape: {
        type: "() => void",
        required: false,
        defaultValue: null,
        description: "Called when Escape is pressed and the event was not already handled.",
      },
      onEnter: {
        type: "() => void",
        required: false,
        defaultValue: null,
        description: "Called when Enter is pressed and the event was not already handled.",
      },
      prefix: {
        type: "ReactNode",
        required: false,
        defaultValue: '"/"',
        description: "Prefix content before the input. Pass null to hide it.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Padding/font size token for the search wrapper.",
      },
      "aria-invalid": {
        type: 'boolean | "true" | "false" | "grammar" | "spelling"',
        required: false,
        defaultValue: null,
        description:
          "Forwarded to the native search input and used by the wrapper for invalid styling.",
      },
    },
  },
};
