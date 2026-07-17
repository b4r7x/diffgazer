import { Tabs } from "@/components/ui/tabs";

const tabs = [
  ["overview", "Project overview"],
  ["review", "Review configuration"],
  ["permissions", "Repository permissions"],
  ["notifications", "Notification settings"],
] as const;

function WrappedTabs({ variant, label }: { variant: "pill" | "underline"; label: string }) {
  return (
    <Tabs defaultValue="overview" variant={variant} className="w-full max-w-[18rem]">
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
      <WrappedTabs variant="pill" label="Wrapped pill tabs" />
      <WrappedTabs variant="underline" label="Wrapped underline tabs" />
    </div>
  );
}
