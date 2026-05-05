import type { ComponentDoc } from "./types"

export const tabsDoc: ComponentDoc = {
  description: "Terminal-styled tabbed interface with horizontal and vertical orientation support.",
  anatomy: [
    { name: "Tabs", indent: 0, note: "Root (manages active tab state)" },
    { name: "TabsList", indent: 1, note: "Container for tab triggers" },
    { name: "TabsTrigger", indent: 2, note: "Clickable tab button" },
    { name: "TabsContent", indent: 1, note: "Panel shown when tab is active" },
  ],
  notes: [
    {
      title: "Orientation Support",
      content:
        "Tabs default to horizontal orientation. Set orientation='vertical' to stack triggers vertically. Keyboard arrow directions automatically align with the orientation.",
    },
  ],
  usage: { example: "tabs-default" },
  examples: [
    { name: "tabs-default", title: "Default" },
    { name: "tabs-vertical", title: "Vertical Orientation" },
    { name: "tabs-controlled", title: "Controlled with Disabled Tab" },
    { name: "tabs-keyboard", title: "Keyboard Navigation" },
  ],
  keyboard: {
    description:
      "TabsList has built-in keyboard navigation via @diffgazer/keys. ArrowLeft/ArrowRight (horizontal) or ArrowUp/ArrowDown (vertical) navigate between tabs. Home/End jump to first/last tab. Enter/Space activate the focused tab.",
    examples: [
      { name: "tabs-keyboard", title: "Keyboard Navigation" },
    ],
  },
}
