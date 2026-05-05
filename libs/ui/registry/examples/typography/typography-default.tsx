import { Typography } from "@/components/ui/typography"

export default function TypographyDefault() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2 block">
          default (sm)
        </span>
        <Typography>
          Standard body text for UI labels, descriptions, and general content.
          Optimized for readability at small sizes with relaxed line spacing.
        </Typography>
      </div>

      <div>
        <span className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2 block">
          prose
        </span>
        <Typography as="p" variant="prose">
          Prose variant uses looser line spacing for comfortable reading of
          longer-form content like documentation and articles. Multiple
          paragraphs flow naturally with consistent vertical rhythm.
        </Typography>
      </div>

      <div>
        <span className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2 block">
          compact (xs)
        </span>
        <Typography as="p" variant="compact" size="xs">
          Compact variant uses smaller text with tighter spacing, suitable for
          secondary information, captions, and dense data displays.
        </Typography>
      </div>

      <div>
        <span className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2 block">
          size=base
        </span>
        <Typography size="base">
          Base size text for when you need slightly larger body copy.
        </Typography>
      </div>

      <div>
        <span className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2 block">
          truncate
        </span>
        <Typography className="truncate max-w-xs">
          This text will be truncated with an ellipsis when it overflows its container boundary.
        </Typography>
      </div>

      <div>
        <span className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2 block">
          lineClamp=2
        </span>
        <Typography lineClamp={2} className="max-w-sm">
          This text is clamped to two lines. Any content beyond the second line
          will be hidden with an ellipsis. Useful for card descriptions, preview
          text, and anywhere you need controlled text overflow.
        </Typography>
      </div>
    </div>
  )
}
