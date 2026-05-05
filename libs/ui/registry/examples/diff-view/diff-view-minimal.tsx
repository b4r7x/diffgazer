import { DiffView } from "@/components/ui/diff-view"

const patch = `@@ -5,3 +5,3 @@
 const config = {
-  theme: "light",
+  theme: "dark",
 }`

export default function DiffViewMinimal() {
  return <DiffView patch={patch} />
}
