import { componentLists } from "@/generated/library-data"

type ComponentListEntry = { name: string; title: string; description: string }

export function getComponentList(libraryId: string): ComponentListEntry[] {
  return (componentLists[libraryId] ?? []) as ComponentListEntry[]
}
