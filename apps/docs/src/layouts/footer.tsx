import { Kbd } from "@/components/ui/kbd/kbd"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-2.5 flex items-center justify-between text-xs text-muted-foreground font-mono shrink-0 select-none z-20">
      <div className="flex gap-8 items-center">
        <div className="flex items-center gap-1.5 hover:text-foreground cursor-help transition-colors">
          <Kbd size="sm">Tab</Kbd>
          <span>Switch Focus</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-foreground cursor-help transition-colors">
          <Kbd size="sm">j/k</Kbd>
          <span>Scroll</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-foreground cursor-help transition-colors">
          <Kbd size="sm">/</Kbd>
          <span>Search</span>
        </div>
        <div className="flex items-center gap-1.5 hover:text-foreground cursor-help transition-colors">
          <Kbd size="sm">c</Kbd>
          <span>Copy Code</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 hover:text-foreground cursor-help transition-colors">
        <Kbd size="sm">Esc</Kbd>
        <span>Back</span>
      </div>
    </footer>
  )
}
