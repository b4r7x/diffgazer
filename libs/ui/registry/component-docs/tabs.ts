import type { ComponentDoc } from "./types";

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
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "TabsList's arrow-key navigation imports from the required @diffgazer/keys peer. Package consumers must install @diffgazer/keys with @diffgazer/ui; packages are not yet published to npm, so use a local checkout until the first release. Importing @diffgazer/ui/components/tabs without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard hooks to local source.",
    },
    {
      title: "Composition Contract",
      content:
        "Use Tabs.List, Tabs.Trigger, and Tabs.Content as explicit children in the Tabs JSX tree. Custom tab visuals belong inside Tabs.Trigger. Components that create triggers internally from an opaque wrapper are not part of the current public contract.",
    },
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
      "TabsList has built-in keyboard navigation via @diffgazer/keys. ArrowLeft/ArrowRight (horizontal) or ArrowUp/ArrowDown (vertical) navigate between tabs. Home/End jump to first/last tab. Enter/Space activate the focused tab. With loop disabled, arrow navigation stops at the edges and fires onNavigationBoundaryReached for composite focus handoff.",
    keys: [
      {
        keys: "ArrowLeft / ArrowRight",
        action: "Moves focus across horizontal tab triggers.",
      },
      { keys: "ArrowUp / ArrowDown", action: "Moves focus across vertical tab triggers." },
      { keys: "Home / End", action: "Moves focus to the first or last enabled trigger." },
      { keys: "Enter / Space", action: "Activates the focused tab in manual mode." },
    ],
    examples: [{ name: "tabs-keyboard", title: "Keyboard Navigation" }],
  },
  dataAttributes: [
    {
      attribute: "data-state",
      appliesTo: "Tabs.Trigger / Tabs.Content",
      values: '"active" | "inactive"',
      description: "Active tab/panel state for styling and visibility.",
    },
    {
      attribute: "data-orientation",
      appliesTo: "Tabs.List",
      values: '"horizontal" | "vertical"',
      description: "Keyboard/navigation axis.",
    },
    {
      attribute: "data-value",
      appliesTo: "Tabs.Trigger / Tabs.Content",
      values: "tab value",
      description: "Stable value pairing triggers and panels.",
    },
    {
      attribute: "data-variant",
      appliesTo: "Tabs.List / Tabs.Trigger",
      values: '"default" | "underline"',
      description: "Visual variant propagated to list and triggers.",
    },
  ],
  props: {
    Tabs: {
      value: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Controlled active tab value. Pair with onChange.",
      },
      defaultValue: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          "Initial active tab value for uncontrolled mode. Defaults to the first enabled Trigger.",
      },
      onChange: {
        type: "(value: string) => void",
        required: false,
        defaultValue: null,
        description: "Fired when the active tab changes.",
      },
      orientation: {
        type: '"horizontal" | "vertical"',
        required: false,
        defaultValue: '"horizontal"',
        description: "Tab list axis. Switches arrow-key navigation direction and aria-orientation.",
      },
      variant: {
        type: '"default" | "underline"',
        required: false,
        defaultValue: '"default"',
        description: "Visual style applied to triggers and the list.",
      },
      activationMode: {
        type: '"automatic" | "manual"',
        required: false,
        defaultValue: '"automatic"',
        description: "Automatic activates on focus; manual requires Enter or Space.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Tabs.List and Tabs.Content subparts.",
      },
    },
    "Tabs.List": {
      loop: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "When true, arrow navigation wraps from last to first trigger and vice versa.",
      },
      onNavigationBoundaryReached: {
        type: '(direction: "previous" | "next", event: KeyboardEvent, key: string) => void',
        required: false,
        defaultValue: null,
        description:
          "Fired when arrow navigation reaches the first/last trigger with loop disabled.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Tabs.Trigger children.",
      },
    },
    "Tabs.Trigger": {
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier matched against Tabs value and the paired Tabs.Content.",
      },
      disabled: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables activation and removes the trigger from arrow navigation.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Trigger label.",
      },
    },
    "Tabs.Content": {
      value: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Stable identifier paired with the matching Tabs.Trigger.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Panel content. Hidden when its trigger is not active.",
      },
    },
  },
};
