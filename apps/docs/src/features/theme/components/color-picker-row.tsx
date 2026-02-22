interface ColorPickerRowProps {
  name: string
  value: string
  onChange: (value: string) => void
}

export function ColorPickerRow({ name, value, onChange }: ColorPickerRowProps) {
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-input border border-border px-2 py-1 text-xs font-mono text-foreground w-24"
        aria-label={`Hex value for ${name}`}
      />
    </div>
  )
}
