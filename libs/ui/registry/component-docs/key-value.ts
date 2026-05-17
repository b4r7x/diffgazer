import type { ComponentDoc } from "./types"

export const keyValueDoc: ComponentDoc = {
  description:
    "Compound component for displaying labeled data. KeyValue wraps one or more KeyValue.Item rows in a semantic description list.",
  notes: [
    {
      title: "When to use KeyValue vs Label",
      content:
        "Use KeyValue for structured multi-row data display (metadata panels, commit info). Use Label for form field labeling.",
    },
    {
      title: "Compound Usage",
      content:
        "Always wrap KeyValue.Item inside KeyValue — this produces a proper <dl> list. For a single pair: <KeyValue><KeyValue.Item label='...' value='...' /></KeyValue>.",
    },
    {
      title: "Color Variants",
      content:
        "5 semantic color variants (default, warning, info, success, error) style the value text. The info variant uses monospace font instead of bold.",
    },
    {
      title: "Bordered Rows",
      content:
        "Set bordered on KeyValue.Item to add a bottom border, vertical padding, and compact text-xs sizing — ideal for stacked list layouts.",
    },
    {
      title: "Layout Options",
      content:
        "Horizontal layout (default) places label and value side-by-side. Vertical layout stacks them with a small gap. Both label and value accept ReactNode.",
    },
    {
      title: "Class Slots",
      content:
        "Use labelClassName and valueClassName for app-specific label/value styling while preserving the <dl>/<dt>/<dd> structure.",
    },
  ],
  usage: { example: "key-value-default" },
  examples: [
    { name: "key-value-default", title: "Default" },
    { name: "key-value-variants", title: "Variants" },
    { name: "key-value-bordered", title: "Bordered" },
    { name: "key-value-list", title: "List" },
  ],
  keyboard: null,
  props: {
    KeyValue: {
      layout: {
        type: '"horizontal" | "vertical"',
        required: false,
        defaultValue: '"horizontal"',
        description: "Horizontal places label and value side-by-side; vertical stacks them. Propagated to KeyValue.Item via context.",
      },
      bordered: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Adds row borders and switches items to compact xs sizing. Propagated to KeyValue.Item via context.",
      },
      children: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "KeyValue.Item rows rendered inside a semantic <dl>.",
      },
    },
    "KeyValue.Item": {
      label: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Label content rendered in a <dt>.",
      },
      value: {
        type: "ReactNode",
        required: true,
        defaultValue: null,
        description: "Value content rendered in a <dd>.",
      },
      variant: {
        type: '"default" | "warning" | "info" | "success" | "error"',
        required: false,
        defaultValue: '"default"',
        description: "Color token applied to the value. Info uses monospace; the rest are bold semantic colors.",
      },
      layout: {
        type: '"horizontal" | "vertical"',
        required: false,
        defaultValue: "inherited from KeyValue",
        description: "Per-row override of the parent layout.",
      },
      bordered: {
        type: "boolean",
        required: false,
        defaultValue: "inherited from KeyValue",
        description: "Per-row override of the parent bordered prop.",
      },
      labelClassName: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Class applied to the <dt> in addition to the variant classes.",
      },
      valueClassName: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Class applied to the <dd> in addition to the variant classes.",
      },
    },
  },
}
