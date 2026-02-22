import componentList from "@/generated/component-list.json"
import { ComponentPage } from "@/components/component-page"
import { useComponentDocData } from "./component-doc-context"

interface ComponentDocPageProps {
  name: string
}

interface ComponentDocNeighbors {
  prev: string | null
  next: string | null
}

function getComponentDocNeighbors(componentName: string): ComponentDocNeighbors {
  const index = componentList.findIndex((entry) => entry.name === componentName)

  return {
    prev: index > 0 ? componentList[index - 1]?.name ?? null : null,
    next:
      index >= 0 && index < componentList.length - 1
        ? componentList[index + 1]?.name ?? null
        : null,
  }
}

export function ComponentDocPage({ name }: ComponentDocPageProps) {
  const data = useComponentDocData(name)

  if (!data) {
    if (import.meta.env.DEV) {
      console.warn(`Component docs data is unavailable for "${name}".`)
    }
    return null
  }

  const { prev, next } = getComponentDocNeighbors(data.name)

  return <ComponentPage data={data} prev={prev} next={next} />
}
