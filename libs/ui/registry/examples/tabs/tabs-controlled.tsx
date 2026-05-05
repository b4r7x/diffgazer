"use client";

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function TabsControlled() {
  const [tab, setTab] = useState("output")
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted-foreground">
        Active tab: <span className="text-foreground font-bold">{tab}</span>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="debug" disabled>Debug</TabsTrigger>
        </TabsList>
        <TabsContent value="output">
          <div className="border border-border p-4 text-sm font-mono">
            Build completed in 2.3s
          </div>
        </TabsContent>
        <TabsContent value="errors">
          <div className="border border-border p-4 text-sm text-destructive">
            No errors found.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
