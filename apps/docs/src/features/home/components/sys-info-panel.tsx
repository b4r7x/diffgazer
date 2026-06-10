import { KeyValue } from "@diffgazer/ui/components/key-value";
import { Logo } from "@diffgazer/ui/components/logo";
import { Panel } from "@diffgazer/ui/components/panel";
import { HEADING_ASCII } from "@/generated/logo-ascii";
import { DOCS_CHROME_VERSION, DOCS_REGISTRY_HOST } from "@/lib/docs-chrome";

export function SysInfoPanel() {
  return (
    <Panel frame="hairline" className="shrink-0 lg:flex">
      <div className="flex flex-1 flex-col justify-center border-b border-border p-6 lg:border-r lg:border-b-0">
        <Logo
          aria-hidden="true"
          text="Documentation"
          asciiText={HEADING_ASCII.documentation}
          className="mb-4 text-[8px] leading-[1.2] text-foreground md:text-[10px]"
        />
        <p className="max-w-2xl font-mono text-sm leading-relaxed text-muted-foreground">
          Reference for diffgazer's keyboard-first React UI primitives and the headless keys layer
          they are built on. Copy components in with the CLI or read each library's components,
          hooks, and guides.
        </p>
      </div>
      <div className="flex w-full flex-col justify-center p-4 font-mono text-sm text-muted-foreground lg:w-64">
        <KeyValue className="gap-x-4">
          <KeyValue.Item label="STATUS:" value="OPERATIONAL" />
          <KeyValue.Item
            label="UPTIME:"
            value="99.9%"
            valueClassName="font-normal text-muted-foreground"
          />
          <KeyValue.Item
            label="VERSION:"
            value={`${DOCS_CHROME_VERSION}-stable`}
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
