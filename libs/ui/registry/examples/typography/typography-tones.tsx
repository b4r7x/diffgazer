import { Typography } from "@/components/ui/typography";

export default function TypographyTones() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">weight</span>
        <Typography weight="normal">normal — default body weight</Typography>
        <Typography weight="medium">medium — mild emphasis</Typography>
        <Typography weight="semibold">semibold — labels and totals</Typography>
        <Typography weight="bold">bold — headings and alerts</Typography>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">color</span>
        <Typography color="default">default — primary reading color</Typography>
        <Typography color="muted">muted — secondary information</Typography>
        <Typography color="accent">accent — highlighted value</Typography>
      </div>
    </div>
  );
}
