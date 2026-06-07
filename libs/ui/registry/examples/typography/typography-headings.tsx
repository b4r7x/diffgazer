import { Typography } from "@/components/ui/typography";

export default function TypographyHeadings() {
  return (
    <div className="space-y-4">
      <Typography as="h1">Heading 1 — 3xl bold</Typography>
      <Typography as="h2">Heading 2 — 2xl bold</Typography>
      <Typography as="h3">Heading 3 — xl bold</Typography>
      <Typography as="h4">Heading 4 — lg bold</Typography>
      <Typography as="h5">Heading 5 — base bold</Typography>
      <Typography as="h6">Heading 6 — sm bold</Typography>

      <div className="pt-4 border-t border-tui-border">
        <Typography as="h3" size="base" weight="medium">
          Custom size override — h3 at base/medium
        </Typography>
      </div>
    </div>
  );
}
