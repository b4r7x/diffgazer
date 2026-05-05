import { KeyValue } from "@/components/ui/key-value"
import { Badge } from "@/components/ui/badge"

export default function KeyValueBordered() {
  return (
    <KeyValue bordered>
      <KeyValue.Item
        label="API Key Status"
        value={<Badge variant="info">[ STORED ]</Badge>}
      />
    </KeyValue>
  )
}
