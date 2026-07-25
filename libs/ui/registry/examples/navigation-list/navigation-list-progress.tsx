"use client";

import { useState } from "react";
import { NavigationList } from "@/components/ui/navigation-list";

// The Status slot is muted by default. A semantic tone is passed only where the
// label carries that meaning — running is a warning, blocked is an error.
const stages = [
  { id: "build", title: "Build", progress: 100, status: "DONE", tone: "text-success" },
  { id: "test", title: "Lint & Test", progress: 80, status: "RUNNING", tone: "text-warning" },
  { id: "scan", title: "Security Scan", progress: 60, status: "RUNNING", tone: "text-warning" },
  { id: "staging", title: "Deploy Staging", progress: 0, status: "PENDING", tone: undefined },
  { id: "prod", title: "Deploy Prod", progress: 0, status: "BLOCKED", tone: "text-error" },
];

export default function NavigationListProgress() {
  const [selected, setSelected] = useState("build");
  return (
    <div className="w-80 border border-border">
      <NavigationList selectedId={selected} onSelect={setSelected} aria-label="Pipeline">
        {stages.map((stage) => (
          <NavigationList.Item key={stage.id} id={stage.id}>
            <NavigationList.Title>{stage.title}</NavigationList.Title>
            <NavigationList.Status className={stage.tone}>{stage.status}</NavigationList.Status>
            <NavigationList.Meta>
              <NavigationList.Progress value={stage.progress} />
            </NavigationList.Meta>
          </NavigationList.Item>
        ))}
      </NavigationList>
    </div>
  );
}
