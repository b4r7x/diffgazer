import type { HookDoc } from "@diffgazer/registry"

export const useFocusZoneDoc: HookDoc = {
  description:
    "Manage focus across multiple zones with arrow key and Tab transitions. Supports controlled and uncontrolled zone state.",
  usage: {
    code: [
      `const { zone, inZone, forZone } = useFocusZone({`,
      `  initial: "sidebar",`,
      `  zones: ["sidebar", "main", "footer"] as const,`,
      `})`,
    ].join("\n"),
    lang: "tsx",
  },
  parameters: [
    {
      name: "initial",
      type: "T",
      required: true,
      description: "The initial active zone when in uncontrolled mode.",
    },
    {
      name: "zones",
      type: "readonly T[]",
      required: true,
      description: "All available zone identifiers.",
    },
    {
      name: "zone",
      type: "T",
      required: false,
      description:
        "Controlled zone value. When provided, the hook operates in controlled mode.",
    },
    {
      name: "onZoneChange",
      type: "(zone: T) => void",
      required: false,
      description: "Called whenever the active zone changes.",
    },
    {
      name: "onLeaveZone",
      type: "(zone: T) => void",
      required: false,
      description: "Called when focus leaves a zone.",
    },
    {
      name: "onEnterZone",
      type: "(zone: T) => void",
      required: false,
      description: "Called when focus enters a zone.",
    },
    {
      name: "transitions",
      type: '(params: { zone: T; key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" }) => T | null',
      required: false,
      description:
        "Custom transition function. Return the target zone for a key press, or null to block the transition.",
    },
    {
      name: "tabCycle",
      type: "readonly T[]",
      required: false,
      description:
        "Zone order for Tab/Shift+Tab cycling. Defaults to the zones array order.",
    },
    {
      name: "scope",
      type: "string",
      required: false,
      description: "Keyboard scope name to push while the focus zone is active.",
    },
    {
      name: "enabled",
      type: "boolean",
      required: false,
      description: "Whether the focus zone hook is active.",
      defaultValue: "true",
    },
  ],
  returns: {
    type: "UseFocusZoneReturn<T>",
    description:
      "Object with zone state and helpers for conditional rendering and key options.",
    properties: [
      {
        name: "zone",
        type: "T",
        required: true,
        description: "The currently active zone.",
      },
      {
        name: "setZone",
        type: "(zone: T) => void",
        required: true,
        description: "Imperatively set the active zone.",
      },
      {
        name: "inZone",
        type: "(...zones: T[]) => boolean",
        required: true,
        description:
          "Returns true if the current zone matches any of the provided zones.",
      },
      {
        name: "forZone",
        type: "(target: T, extra?: UseKeyOptions) => UseKeyOptions",
        required: true,
        description:
          "Returns UseKeyOptions scoped to a specific zone, merging with optional extra options.",
      },
      {
        name: "zoneProps",
        type: '(target: T) => { "data-focused": true | undefined }',
        required: true,
        description:
          "Returns DOM attributes for a zone's container element. Sets data-focused when the zone is active.",
      },
    ],
  },
  notes: [
    {
      title: "Generic over zone type",
      content:
        "useFocusZone is generic over T extends string. Use `as const` arrays for full type inference of zone names.",
    },
    {
      title: "Controlled and uncontrolled",
      content:
        "Pass zone + onZoneChange for controlled mode, or rely on initial for uncontrolled mode.",
    },
    {
      title: "Requires KeyboardProvider",
      content:
        "useFocusZone registers key bindings through the provider context and must be used within a <KeyboardProvider> tree.",
    },
  ],
  examples: [
    { name: "use-focus-zone-basic", title: "Multi-zone layout navigation" },
  ],
  tags: ["provider-dependent", "focus", "zones"],
}
