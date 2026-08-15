import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  ["overview", "Project overview"],
  ["review", "Review configuration"],
  ["permissions", "Repository permissions"],
  ["notifications", "Notification settings"],
] as const;

function WrappedTabs({ variant }: { variant: "pill" | "underline" }) {
  return (
    // max-w-[26rem] fits two or three triggers per row, so the reflow reads as
    // wrapping rather than as a broken vertical stack.
    <Tabs defaultValue="overview" variant={variant} className="w-full max-w-[26rem]">
      <TabsList aria-label={`Wrapped ${variant} tabs`} className="w-full">
        {tabs.map(([value, title]) => (
          <TabsTrigger key={value} value={value}>
            {title}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(([value, title]) => (
        <TabsContent key={value} value={value} className="pt-3 text-sm">
          {title} panel
        </TabsContent>
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
          <WrappedTabs variant={variant} />
        </div>
      ))}
    </div>
  );
}
