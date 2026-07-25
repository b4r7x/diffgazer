import { Typography } from "@/components/ui/typography";

function DemoLabel({ children }: { children: string }) {
  return (
    <span className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
      {children}
    </span>
  );
}

export default function TypographyDefault() {
  return (
    <div className="space-y-6">
      <div>
        <DemoLabel>default (sm)</DemoLabel>
        <Typography>
          Standard body text for UI labels, descriptions, and general content. Optimized for
          readability at small sizes with relaxed line spacing.
        </Typography>
      </div>

      <div>
        <DemoLabel>prose</DemoLabel>
        <Typography as="p" variant="prose">
          Prose variant uses looser line spacing for comfortable reading of longer-form content like
          documentation and articles. Multiple paragraphs flow naturally with consistent vertical
          rhythm.
        </Typography>
      </div>

      <div>
        <DemoLabel>compact (xs)</DemoLabel>
        <Typography as="p" variant="compact" size="xs">
          Compact variant uses smaller text with tighter spacing, suitable for secondary
          information, captions, and dense data displays.
        </Typography>
      </div>

      <div>
        <DemoLabel>size=base</DemoLabel>
        <Typography size="base">
          Base size text for when you need slightly larger body copy.
        </Typography>
      </div>

      <div>
        <DemoLabel>truncate</DemoLabel>
        {/* The border makes the width constraint visible: the text is cut at the box edge. */}
        <div className="max-w-xs border border-border p-2">
          <Typography truncate>
            This text will be truncated with an ellipsis when it overflows its container boundary.
          </Typography>
        </div>
      </div>

      <div>
        <DemoLabel>lineClamp=2</DemoLabel>
        <div className="max-w-sm border border-border p-2">
          <Typography lineClamp={2}>
            This text is clamped to two lines. Any content beyond the second line will be hidden
            with an ellipsis. Useful for card descriptions, preview text, and anywhere you need
            controlled text overflow.
          </Typography>
        </div>
      </div>
    </div>
  );
}
