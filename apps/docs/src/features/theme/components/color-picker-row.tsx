import { useState } from "react";

interface ColorPickerRowProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
}

const FULL_HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function ColorPickerRow({ name, value, onChange }: ColorPickerRowProps) {
  // The hex field keeps its own draft: `<input type="color">` and the preview's
  // custom-property block can only render a complete 6-digit hex, so partial
  // entries stay local until they are a colour the rest of the playground can use.
  const [draft, setDraft] = useState(value);
  const [committedValue, setCommittedValue] = useState(value);

  if (committedValue !== value) {
    setCommittedValue(value);
    setDraft(value);
  }

  const handleHexInput = (next: string) => {
    setDraft(next);
    if (FULL_HEX_COLOR.test(next)) onChange(next);
  };

  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 cursor-pointer border border-border bg-transparent"
        aria-label={`Color picker for ${name}`}
      />
      <span className="text-xs text-muted-foreground w-36 font-mono">{name}</span>
      <input
        type="text"
        value={draft}
        onChange={(e) => handleHexInput(e.target.value)}
        className="bg-input border border-border px-2 py-1 text-xs font-mono text-foreground w-24"
        aria-label={`Hex value for ${name}`}
      />
    </div>
  );
}
