import { KeyValue } from "@/components/ui/key-value"

export default function KeyValueVariants() {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-muted-foreground uppercase font-bold">Horizontal (default)</div>
      <KeyValue>
        <KeyValue.Item label="Status" value="Default" variant="default" />
        <KeyValue.Item label="Response Time" value="120ms" variant="warning" />
        <KeyValue.Item label="API Version" value="v2.1" variant="info" />
        <KeyValue.Item label="Tests" value="Passing" variant="success" />
        <KeyValue.Item label="Errors" value="3 failures" variant="error" />
      </KeyValue>
      <div className="text-xs text-muted-foreground uppercase font-bold mt-4">Vertical Layout</div>
      <KeyValue layout="vertical" className="flex gap-6">
        <KeyValue.Item label="Model" value="GPT-4o" variant="info" />
        <KeyValue.Item label="Tokens" value="1,234" />
        <KeyValue.Item label="Cost" value="$0.02" variant="success" />
      </KeyValue>
    </div>
  )
}
