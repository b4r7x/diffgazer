import type { ComponentDoc } from "./types";

export const avatarDoc: ComponentDoc = {
  description:
    "Terminal-inspired avatar with image support, monospace initials fallback, and group stacking with overflow.",
  anatomy: [
    {
      name: "Avatar",
      indent: 0,
      note: "Square avatar with src/fallback/size. Shows image or monospace initials.",
    },
    {
      name: "AvatarGroup",
      indent: 0,
      note: "Overlapping stack of avatars with max overflow (+N indicator).",
    },
    {
      name: "AvatarIndicator",
      indent: 1,
      note: "Overflow count badge (+N). Auto-rendered by AvatarGroup, or usable standalone.",
    },
  ],
  notes: [
    {
      title: "Image Fallback",
      content:
        "When src fails to load, Avatar falls back to the fallback initials. If no fallback is provided, '?' is shown.",
    },
    {
      title: "Terminal Style",
      content:
        "Square shape with a border and monospace font for initials — following the @diffgazer/ui terminal-inspired aesthetic.",
    },
    {
      title: "Spacing",
      content:
        "AvatarGroup supports spacing='overlap' (default, stacked look) or spacing='gap' (spaced apart). Use 'gap' inside Select triggers or inline layouts where overlap looks cramped.",
    },
    {
      title: "Composition",
      content:
        "Avatar works standalone or inside AvatarGroup. Combine Avatar with public Select parts to build avatar pickers.",
    },
  ],
  usage: { example: "avatar-default" },
  examples: [
    { name: "avatar-default", title: "Default" },
    { name: "avatar-sizes", title: "Sizes" },
    { name: "avatar-group", title: "Group with Overflow" },
  ],
  keyboard: null,
  props: {
    Avatar: {
      src: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Image URL. Ignored when children are provided.",
      },
      alt: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          'Image alt text and accessible name. When omitted, falls back to a string `fallback`. When neither is set, the avatar uses role="presentation".',
      },
      fallback: {
        type: "ReactNode",
        required: false,
        defaultValue: '"?"',
        description: "Shown when the image is loading, missing, or fails.",
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: '"md"',
        description: "Square size token. Inherits from an AvatarGroup parent when unset.",
      },
      onStatusChange: {
        type: '(status: "idle" | "loading" | "loaded" | "error") => void',
        required: false,
        defaultValue: null,
        description: "Fired when the image load status changes. Fires for the active image only.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Custom inner content. Replaces the default AvatarImage + AvatarFallback composition.",
      },
    },
    AvatarImage: {
      src: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Image URL.",
      },
      alt: {
        type: "string",
        required: false,
        defaultValue: '""',
        description:
          "Alt text. Defaults to empty when omitted since the parent Avatar already exposes a name.",
      },
    },
    AvatarFallback: {
      src: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Cascading fallback image. Tried before rendering children.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Initials or icon shown when no fallback image is available.",
      },
    },
    AvatarGroup: {
      max: {
        type: "number",
        required: false,
        defaultValue: null,
        description:
          "Hard cap on visible avatars. Values are rounded down; negative and non-finite values become zero. When omitted, AvatarGroup measures overflow with Overflow.",
      },
      spacing: {
        type: '"overlap" | "gap"',
        required: false,
        defaultValue: '"overlap"',
        description: "Overlap stacks avatars; gap spaces them apart.",
      },
      size: {
        type: '"sm" | "md" | "lg" | null',
        required: false,
        defaultValue: '"md"',
        description: "Default size applied to descendant Avatars that do not set their own size.",
      },
      "aria-label": {
        type: "string",
        required: false,
        defaultValue: '"Avatars"',
        description: 'Accessible label for the group container (rendered with role="group").',
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Avatar elements.",
      },
    },
    AvatarIndicator: {
      count: {
        type: "number",
        required: true,
        defaultValue: null,
        description:
          'Number rendered as "+N". Used by AvatarGroup for overflow but available standalone.',
      },
      size: {
        type: '"sm" | "md" | "lg"',
        required: false,
        defaultValue: null,
        description: "Size override. Falls back to the AvatarGroup size.",
      },
      getLabel: {
        type: "(count: number) => string",
        required: false,
        defaultValue: null,
        description:
          'Localizes the indicator accessible name. Defaults to the "N more" pattern when neither getLabel nor aria-label is provided.',
      },
    },
  },
};
