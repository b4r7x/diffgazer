import type { ComponentDoc } from "./types";

export const calloutDoc: ComponentDoc = {
  description:
    "Dismissible alert box with tone-driven coloring, frame variants (inline / rail / bar), and a compound API.",
  anatomy: [
    { name: "Callout", indent: 0, note: "Root (manages visibility, provides tone context)" },
    {
      name: "Callout.Icon",
      indent: 1,
      note: "Tone icon — outlined 14px SVG (overridable via children)",
    },
    { name: "Callout.Title", indent: 1, note: "Bold title text in the tone color" },
    { name: "Callout.Content", indent: 1, note: "Body text in muted color" },
    { name: "Callout.Dismiss", indent: 1, note: "Close button (24×24 with 4px padding)" },
  ],
  notes: [
    {
      title: "Compound Components",
      content:
        "Compose Callout.Icon, Callout.Title, Callout.Content, and Callout.Dismiss as children. Each part inherits the tone from the root Callout via context.",
    },
    {
      title: "Frame variants",
      content:
        'frame="inline" (default): hairline border at tone color + subtle tone bg. frame="rail": no border, 2px inline-start rail at tone color. frame="bar": neutral border + 4px tone marker bar, matching Dialog.Header marker="bar".',
    },
    {
      title: "Default icons",
      content:
        "Each tone ships a default outlined SVG glyph. Pass children to Callout.Icon to override with any ReactNode.",
    },
    {
      title: "Dismissible",
      content:
        "Add Callout.Dismiss as a child to show a close button. In uncontrolled mode the callout self-dismisses. For controlled mode, pass open and onOpenChange to the root Callout.",
    },
    {
      title: "Accessibility",
      content:
        'Static callouts have no role. Pass live to opt into role="status" (or role="alert" for tone="error") so assistive tech announces the message. A visually-hidden tone prefix ("Warning:", "Error:", …) is always rendered so the message is unambiguous without color.',
    },
  ],
  usage: { example: "callout-default" },
  examples: [
    { name: "callout-default", title: "Default" },
    { name: "callout-tones", title: "Tones" },
    { name: "callout-frames", title: "Frames" },
    { name: "callout-controlled", title: "Controlled visibility" },
    { name: "callout-custom-icon", title: "Custom icon" },
  ],
  keyboard: null,
  props: {
    Callout: {
      tone: {
        type: '"info" | "warning" | "error" | "success"',
        required: false,
        defaultValue: '"info"',
        description: "Semantic tone — drives color and default icon.",
      },
      frame: {
        type: '"inline" | "rail" | "bar"',
        required: false,
        defaultValue: '"inline"',
        description: "Visual frame: inline border, inline-start rail, or marker bar.",
      },
      open: {
        type: "boolean",
        required: false,
        defaultValue: null,
        description: "Controlled visibility state. Pair with onOpenChange.",
      },
      defaultOpen: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Initial visibility state for uncontrolled usage.",
      },
      onOpenChange: {
        type: "(open: boolean) => void",
        required: false,
        defaultValue: null,
        description:
          "Called when Callout.Dismiss closes the callout or controlled state should change.",
      },
      live: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description:
          'Opt into role="status" (or role="alert" for tone="error") for live-region announcement.',
      },
      toneLabel: {
        type: "string",
        required: false,
        defaultValue: "tone name",
        description: "Screen-reader tone word announced before the content.",
      },
    },
    "Callout.Icon": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: "tone icon",
        description: "Custom icon content. The icon is decorative and aria-hidden.",
      },
    },
    "Callout.Title": {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Title text for the callout.",
      },
    },
    "Callout.Content": {
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Body content for the callout.",
      },
    },
    "Callout.Dismiss": {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: '"[x]"',
        description: "Custom dismiss button content.",
      },
    },
  },
};
