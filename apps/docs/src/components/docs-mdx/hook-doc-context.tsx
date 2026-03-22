import type { HookDocPageProps } from "@/components/hook-doc-page"
import { createDocDataContext } from "@/lib/create-doc-data-context"

export type HookData = HookDocPageProps["data"]

const { Provider, useData } = createDocDataContext<HookData>({ returnValueWhenNoName: true })

export { Provider as HookDocDataProvider, useData as useHookDocData }
