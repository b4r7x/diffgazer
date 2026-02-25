import { HookDocPage as HookDocPageRenderer } from "@/components/hook-doc-page"
import { useHookDocData } from "./hook-doc-context"

export function HookDocPageMdx() {
  const data = useHookDocData()

  if (!data) {
    if (import.meta.env.DEV) {
      console.warn("Hook docs data is unavailable for this page.")
    }
    return null
  }

  return <HookDocPageRenderer data={data} />
}
