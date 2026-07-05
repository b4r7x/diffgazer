import { KeyValue } from "@diffgazer/ui/components/key-value";
import { Panel } from "@diffgazer/ui/components/panel";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { DOCS_CHROME_VERSION, DOCS_REGISTRY_HOST } from "@/lib/docs-chrome";

export function SysInfoPanel() {
  return (
    <Panel frame="hairline" className="flex w-full shrink-0 flex-col lg:w-64">
      <div className="shrink-0 border-b border-border px-4 py-2">
        <span className={CHROME_LABEL_CLASS}>SYS INFO</span>
      </div>
      <div className="flex flex-1 flex-col justify-center p-4 font-mono text-sm text-muted-foreground">
        <KeyValue className="gap-x-4">
          <KeyValue.Item label="STATUS:" value="ONLINE" />
          <KeyValue.Item
            label="VERSION:"
            value={DOCS_CHROME_VERSION}
            valueClassName="font-normal text-muted-foreground"
          />
          <KeyValue.Item
            label="REGISTRY:"
            value={DOCS_REGISTRY_HOST}
            labelClassName="mt-2 border-t border-dashed border-border pt-2"
            valueClassName="mt-2 border-t border-dashed border-border pt-2 font-normal"
          />
        </KeyValue>
      </div>
    </Panel>
  );
}
