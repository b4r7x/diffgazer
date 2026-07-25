import { Tabs } from "@/components/ui/tabs";

const tabs = [
  ["overview", "Project overview"],
  ["review", "Review configuration"],
  ["permissions", "Repository permissions"],
  ["notifications", "Notification settings"],
] as const;

function WrappedTabs({ variant, label }: { variant: "pill" | "underline"; label: string }) {
  return (
    // max-w-[26rem] fits two or three triggers per row, so the reflow reads as
    // wrapping rather than as a broken vertical stack.
    <Tabs defaultValue="overview" variant={variant} className="w-full max-w-[26rem]">
      <Tabs.List aria-label={label} className="w-full">
        {tabs.map(([value, title]) => (
          <Tabs.Trigger key={value} value={value}>
            {title}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map(([value, title]) => (
        <Tabs.Content key={value} value={value} className="pt-3 text-sm">
          {title} panel
        </Tabs.Content>
      ))}
    </Tabs>
  );
}

export default function TabsReflowExample() {
  return (
    <div className="grid w-full gap-6">
      {(["pill", "underline"] as const).map((variant) => (
        <div key={variant} className="flex flex-col gap-2">
          <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
            {variant}
          </span>
          <WrappedTabs variant={variant} label={`Wrapped ${variant} tabs`} />
        </div>
      ))}
    </div>
  );
}
