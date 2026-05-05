import { KeyValue } from "@/components/ui/key-value"

export default function KeyValueList() {
  return (
    <KeyValue bordered>
      <KeyValue.Item label="Commit" value="a1b2c3d" variant="info" />
      <KeyValue.Item label="Author" value="Ada Lovelace" />
      <KeyValue.Item label="Date" value="2026-02-10 14:30" />
      <KeyValue.Item label="Branch" value="feature/add-toasts" variant="info" />
      <KeyValue.Item label="Files Changed" value="7" variant="success" />
    </KeyValue>
  )
}
