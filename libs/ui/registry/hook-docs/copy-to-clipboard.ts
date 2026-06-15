import type { HookDoc } from "@diffgazer/registry";

export const copyToClipboardDoc: HookDoc = {
  description:
    "Copy-to-clipboard state machine. Writes text to the clipboard and exposes an idle, copied, or failed status that resets after a delay.",
  usage: {
    code: `const { status, copy } = useCopyToClipboard({ resetMs: 1500 });

return (
  <button type="button" onClick={() => copy("var(--foreground)")}>
    {status === "copied" ? "Copied" : "Copy"}
  </button>
);`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "options.resetMs",
      type: "number",
      required: false,
      defaultValue: "2000",
      description: "Milliseconds before copied or failed status resets to idle.",
    },
    {
      name: "options.write",
      type: "(text: string) => Promise<void> | void",
      required: false,
      defaultValue: "navigator.clipboard.writeText",
      description: "Custom clipboard writer. Useful for tests or alternate clipboard adapters.",
    },
    {
      name: "options.onCopy",
      type: "(text: string) => void",
      required: false,
      description: "Called after a successful write.",
    },
    {
      name: "options.onError",
      type: "(error: unknown) => void",
      required: false,
      description: "Called when the write fails.",
    },
  ],
  returns: {
    type: "UseCopyToClipboardResult",
    description: "Current copy status plus an async copy command.",
    properties: [
      {
        name: "status",
        type: '"idle" | "copied" | "failed"',
        required: true,
        description: "Current state of the last copy attempt.",
      },
      {
        name: "copied",
        type: "boolean",
        required: true,
        description: "True while status is copied.",
      },
      {
        name: "failed",
        type: "boolean",
        required: true,
        description: "True while status is failed.",
      },
      {
        name: "copy",
        type: "(text: string) => Promise<boolean>",
        required: true,
        description: "Writes text and resolves true on success or false on failure.",
      },
    ],
  },
  notes: [
    {
      title: "Reset behavior",
      content:
        "Each copy attempt restarts the reset timer. The pending timer is cleared when the component unmounts.",
    },
    {
      title: "Clipboard writer",
      content:
        "By default the hook calls navigator.clipboard.writeText. Pass write when your environment needs a custom clipboard implementation.",
    },
  ],
  tags: ["hook", "clipboard", "feedback"],
};
