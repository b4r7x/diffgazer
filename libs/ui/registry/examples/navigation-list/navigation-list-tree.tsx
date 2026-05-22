"use client"

import { useState } from "react"
import { NavigationList } from "@/components/ui/navigation-list"

export default function NavigationListTree() {
  const [selected, setSelected] = useState("input-tsx")

  return (
    <NavigationList selectedId={selected} onSelect={setSelected} aria-label="File tree">
      <NavigationList.Group label="src" variant="tree">
        <NavigationList.Group label="components" variant="tree">
          <NavigationList.Item id="button-tsx">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="input-tsx">
            <NavigationList.Title>Input.tsx</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="dialog-tsx">
            <NavigationList.Title>Dialog.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
        <NavigationList.Group label="hooks" variant="tree">
          <NavigationList.Item id="use-float-ts">
            <NavigationList.Title>useFloat.ts</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
        <NavigationList.Item id="utils-ts">
          <NavigationList.Title>utils.ts</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList.Group>
      <NavigationList.Group label="tests" variant="tree" defaultExpanded={false}>
        <NavigationList.Item id="button-test">
          <NavigationList.Title>Button.test.tsx</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="input-test">
          <NavigationList.Title>Input.test.tsx</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList.Group>
    </NavigationList>
  )
}
