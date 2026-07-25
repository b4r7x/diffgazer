import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// bracket first: [ label ] is the library's signature trigger treatment.
const VARIANTS = [
  { value: "bracket", note: "Signature — markers appear on the active trigger." },
  { value: "default", note: "Boxed triggers; active inverts to the primary fill." },
  { value: "pill", note: "Sliding indicator inside an inset track." },
  { value: "underline", note: "Hairline row with a sliding underline." },
] as const;

const TABS = ["Diff", "Findings", "Log"] as const;

export default function TabsVariants() {
  return (
    <div className="flex flex-col gap-6">
      {VARIANTS.map(({ value, note }) => (
        <div key={value} className="flex flex-col gap-2">
          <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
            {value}
          </span>
          <Tabs defaultValue="Diff" variant={value}>
            <TabsList aria-label={`${value} tabs`}>
              {TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="Diff">
              <p className="text-xs text-muted-foreground">{note}</p>
            </TabsContent>
            <TabsContent value="Findings">
              <p className="text-xs text-muted-foreground">Findings panel</p>
            </TabsContent>
            <TabsContent value="Log">
              <p className="text-xs text-muted-foreground">Log panel</p>
            </TabsContent>
          </Tabs>
        </div>
      ))}
    </div>
  );
}
