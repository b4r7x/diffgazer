import type { ComponentDoc } from "./types.js";

export const kbdDoc: ComponentDoc = {
  description: "Keyboard key indicator rendered as an inline kbd element with terminal styling.",
  notes: [
    {
      title: "Size Variants",
      content:
        "Available in sm and md sizes (defaults to md). Renders inline, designed for use inside text.",
    },
    {
      title: "Terminal Styling",
      content:
        "Rendered with a hairline border and a translucent --foreground fill so the key cap carries the same inline weight in light and dark palettes.",
    },
    {
      title: "Inverse surfaces",
      content:
        'Use `variant="inverse"` for caps on a bar painted in --foreground (shortcut legends, app footers). It mirrors the same border/fill recipe against --background, so the cap keeps its weight instead of disappearing into the inverted bar.',
    },
    {
      title: "Chord Grammar",
      content:
        "Two grammars are supported and should not be mixed on one surface: platform chords place modifier glyphs adjacent with no separator (Command K), spelled-out chords use a dimmed + between caps (Ctrl + Shift + P). Wrap either in KbdGroup and give the group an aria-label so assistive tech announces the whole shortcut.",
    },
  ],
  usage: { example: "kbd-default" },
  examples: [
    { name: "kbd-sizes", title: "Sizes" },
    { name: "kbd-inline", title: "Inline" },
    { name: "kbd-group", title: "Group" },
  ],
  keyboard: null,
  props: {
    Kbd: {
      size: {
        type: '"sm" | "md"',
        required: false,
        defaultValue: '"md"',
        description: "Padding and font-size token applied to the kbd glyph.",
      },
      variant: {
        type: '"default" | "inverse"',
        required: false,
        defaultValue: '"default"',
        description:
          "Surface the cap is painted for: default (page background) or inverse (a --foreground bar).",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Key glyph or short label rendered inside the <kbd> element.",
      },
    },
    KbdGroup: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Sequence of Kbd children rendered inline with a small gap.",
      },
    },
  },
};
