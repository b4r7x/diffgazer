import { KeyValue } from "@/components/ui/key-value";

export default function KeyValueDescription() {
  return (
    <KeyValue>
      <KeyValue.Item
        label="Provider"
        value="OpenRouter"
        description="Routes each request to the cheapest healthy upstream for the selected model."
      />
      <KeyValue.Item label="Model" value="claude-sonnet-4" variant="info" />
    </KeyValue>
  );
}
