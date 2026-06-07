import type { ComponentDoc } from "./types";

export const logoDoc: ComponentDoc = {
  description:
    "Renders static text or caller-provided ASCII art without loading figlet from the default component export.",
  notes: [
    {
      title: "ASCII Text",
      content:
        "Precompute ASCII art and pass it through asciiText. The Logo component itself never imports figlet, so consumers stay in control of the ASCII source.",
    },
    {
      title: "Optional figlet helper (npm package only)",
      content:
        "When you install @diffgazer/ui via npm, an optional helper is exposed at @diffgazer/ui/components/logo/figlet that wraps the figlet runtime. This entry is only available in package mode — copy/dgadd installs do not vend it. Copy-mode consumers who want runtime figlet output should install figlet themselves (npm install figlet @types/figlet) and call figlet.textSync(...) directly.",
    },
    {
      title: "Sizing",
      content:
        "ASCII output can be large. Use small text sizes (text-[6px] to text-[10px]) and responsive sizing to fit it in your layout.",
    },
  ],
  usage: { example: "logo-default" },
  examples: [
    { name: "logo-default", title: "Default" },
    { name: "logo-fonts", title: "ASCII Text" },
    { name: "logo-styled", title: "Styled" },
    { name: "logo-figlet", title: "Figlet Integration" },
  ],
  keyboard: null,
  props: {
    Logo: {
      text: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Display text, also used as the accessible name when asciiText is provided.",
      },
      asciiText: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          'Precomputed ASCII art. When set, renders inside <pre role="img" aria-label={text}>.',
      },
    },
  },
};
