import type { ComponentDoc } from "./types"

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
        "When src fails to load, Avatar gracefully falls back to the fallback initials. If no fallback is provided, '?' is shown.",
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
}
