import { DiffView } from "@/components/ui/diff-view"

const patch = `@@ -5,3 +5,3 @@
 const config = {
-  theme: "light",
+  theme: "dark",
 }`

export default function DiffViewLineNumbers() {
  return (
    <div className="flex flex-col gap-4">
      <DiffView patch={patch} showLineNumbers />
      <DiffView patch={patch} mode="split" showLineNumbers />
    </div>
  )
}
