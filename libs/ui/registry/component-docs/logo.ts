import type { ComponentDoc } from "./types"

export const logoDoc: ComponentDoc = {
  description:
    "Renders text as ASCII art using figlet fonts. Includes a standalone getFigletText utility for non-JSX usage.",
  notes: [
    {
      title: "Font Loading",
      content:
        "Fonts are parsed eagerly on first import. The bundled fonts (Big and Small) are imported statically, so no network requests are made.",
    },
    {
      title: "Sizing",
      content:
        "Figlet output can be large. Use small text sizes (text-[6px] to text-[10px]) and responsive sizing to fit it in your layout.",
    },
  ],
  usage: { example: "logo-default" },
  examples: [
    { name: "logo-default", title: "Default" },
    { name: "logo-fonts", title: "Font Comparison" },
    { name: "logo-styled", title: "Styled" },
  ],
  keyboard: null,
}
