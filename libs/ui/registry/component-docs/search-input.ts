import type { ComponentDoc } from "./types"

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
      title: "Error & Disabled",
      content:
        "Pass error to show destructive border styling and aria-invalid. Pass disabled to prevent interaction.",
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
}
