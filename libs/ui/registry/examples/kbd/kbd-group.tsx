import { Kbd, KbdGroup } from "@/components/ui/kbd";

/**
 * Two deliberate chord grammars. Platform chords (macOS modifier glyphs) sit
 * adjacent with no separator; spelled-out chords use a dimmed `+`. Pick one per
 * surface and keep it — the demo labels both so the choice reads as intentional.
 */
export default function KbdGroupExample() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs uppercase tracking-wider text-muted-foreground">
          Platform chord
        </span>
        <KbdGroup aria-label="Command K">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs uppercase tracking-wider text-muted-foreground">
          Spelled-out chord
        </span>
        <KbdGroup aria-label="Control Shift P">
          <Kbd>Ctrl</Kbd>
          <span aria-hidden="true" className="text-muted-foreground text-xs">
            +
          </span>
          <Kbd>Shift</Kbd>
          <span aria-hidden="true" className="text-muted-foreground text-xs">
            +
          </span>
          <Kbd>P</Kbd>
        </KbdGroup>
      </div>
    </div>
  );
}
