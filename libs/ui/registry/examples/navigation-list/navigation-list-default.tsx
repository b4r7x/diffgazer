"use client"

import { useState } from "react"
import { NavigationList } from "@/components/ui/navigation-list"

export default function NavigationListDefault() {
  const [selected, setSelected] = useState("review-1")

  return (
    <NavigationList selectedId={selected} onSelect={setSelected} aria-label="Reviews">
      <NavigationList.Item id="review-1">
        <NavigationList.Title>feat: add toast component</NavigationList.Title>
        <NavigationList.Meta>
          <NavigationList.Badge variant="info">NEW</NavigationList.Badge>
          <NavigationList.Subtitle>3 files changed</NavigationList.Subtitle>
        </NavigationList.Meta>
      </NavigationList.Item>
      <NavigationList.Item id="review-2">
        <NavigationList.Title>fix: dialog close on escape</NavigationList.Title>
        <NavigationList.Meta>
          <NavigationList.Badge variant="success">PASS</NavigationList.Badge>
          <NavigationList.Subtitle>1 file changed</NavigationList.Subtitle>
        </NavigationList.Meta>
      </NavigationList.Item>
      <NavigationList.Item id="review-3">
        <NavigationList.Title>refactor: menu keyboard handling</NavigationList.Title>
        <NavigationList.Status>!</NavigationList.Status>
        <NavigationList.Meta>
          <NavigationList.Badge variant="error">FAIL</NavigationList.Badge>
          <NavigationList.Subtitle>7 files changed</NavigationList.Subtitle>
        </NavigationList.Meta>
      </NavigationList.Item>
      <NavigationList.Item id="review-4" disabled>
        <NavigationList.Title>chore: update dependencies</NavigationList.Title>
        <NavigationList.Meta>
          <NavigationList.Subtitle>archived</NavigationList.Subtitle>
        </NavigationList.Meta>
      </NavigationList.Item>
    </NavigationList>
  )
}
