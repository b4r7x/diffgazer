import type { ComponentData } from "@/types/docs-data"
import { createDocDataContext } from "@/lib/create-doc-data-context"

const { Provider, useData } = createDocDataContext<ComponentData>()

export { Provider as ComponentDocDataProvider, useData as useComponentDocData }
