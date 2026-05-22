"use client"

import { useState } from "react"
import { NavigationList } from "@/components/ui/navigation-list"

export default function NavigationListSections() {
  const [selected, setSelected] = useState("pr-1")

  return (
    <NavigationList selectedId={selected} onSelect={setSelected} aria-label="Project items">
      <NavigationList.Group label="Pull Requests" count={3}>
        <NavigationList.Item id="pr-1">
          <NavigationList.Title>Fix auth flow</NavigationList.Title>
          <NavigationList.Status>ready</NavigationList.Status>
        </NavigationList.Item>
        <NavigationList.Item id="pr-2">
          <NavigationList.Title>Update deps</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Badge variant="neutral">draft</NavigationList.Badge>
          </NavigationList.Meta>
        </NavigationList.Item>
        <NavigationList.Item id="pr-3">
          <NavigationList.Title>Add tests</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList.Group>
      <NavigationList.Group label="Issues" count={4}>
        <NavigationList.Item id="issue-1">
          <NavigationList.Title>Memory leak #42</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Badge variant="error">bug</NavigationList.Badge>
          </NavigationList.Meta>
        </NavigationList.Item>
        <NavigationList.Item id="issue-2">
          <NavigationList.Title>Dark mode #38</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="issue-3">
          <NavigationList.Title>API docs #35</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="issue-4">
          <NavigationList.Title>Perf audit #31</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList.Group>
      <NavigationList.Group label="Discussions" count={2} defaultExpanded={false}>
        <NavigationList.Item id="disc-1">
          <NavigationList.Title>RFC: new API</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="disc-2">
          <NavigationList.Title>Roadmap Q3</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList.Group>
    </NavigationList>
  )
}
