import type { ComponentDoc } from "./types"

export const logoDoc: ComponentDoc = {
  description:
    "Renders static text or caller-provided ASCII art without loading figlet from the default component export.",
  notes: [
    {
      title: "ASCII Text",
      content:
        "Precompute ASCII art and pass it through asciiText. The package helper is available from @diffgazer/ui/components/logo/figlet when runtime generation is needed.",
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
  ],
  keyboard: null,
}
