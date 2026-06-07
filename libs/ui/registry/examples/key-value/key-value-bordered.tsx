import { Badge } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/key-value";

export default function KeyValueBordered() {
  return (
    <KeyValue bordered>
      <KeyValue.Item label="API Key Status" value={<Badge variant="info">[ STORED ]</Badge>} />
    </KeyValue>
  );
}
