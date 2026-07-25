import { Divider } from "@/components/ui/divider";

export default function DividerVertical() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-24 items-center gap-4">
        <span className="text-sm text-muted-foreground">Left</span>
        <Divider orientation="vertical" />
        <span className="text-sm text-muted-foreground">Right</span>
      </div>

      <div className="flex h-24 items-center">
        <span className="text-sm text-muted-foreground">Local</span>
        <Divider variant="spaced" orientation="vertical">
          or
        </Divider>
        <span className="text-sm text-muted-foreground">Remote</span>
      </div>
    </div>
  );
}
