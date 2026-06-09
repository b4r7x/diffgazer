import { Logo } from "@diffgazer/ui/components/logo";
import { Panel } from "@diffgazer/ui/components/panel";
import { HEADING_ASCII } from "@/generated/logo-ascii";
import { DOCS_CHROME_VERSION, DOCS_REGISTRY_HOST } from "@/lib/docs-chrome";

export function SysInfoPanel() {
  return (
    <Panel frame="hairline" className="shrink-0 lg:flex lg:flex-row">
      <div className="flex flex-1 flex-col justify-center border-b border-border p-6 lg:border-r lg:border-b-0">
        <h1 className="sr-only">Documentation</h1>
        <Logo
          aria-hidden="true"
          text="Documentation"
          asciiText={HEADING_ASCII.documentation}
          className="mb-4 text-[10px] leading-[1.2] text-foreground md:text-xs"
        />
        <p className="max-w-2xl font-mono text-sm leading-relaxed text-muted-foreground">
          Reference for diffgazer's keyboard-first React UI primitives and the headless keys layer
          they are built on. Copy components in with the CLI or read each library's components,
          hooks, and guides.
        </p>
      </div>
      <div className="flex w-full flex-col justify-center gap-2 p-4 font-mono text-sm text-muted-foreground lg:w-64">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">STATUS:</span>
          <span className="font-bold text-foreground">OPERATIONAL</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">UPTIME:</span>
          <span>99.9%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">VERSION:</span>
          <span>{DOCS_CHROME_VERSION}-stable</span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-dashed border-border pt-2">
          <span className="text-muted-foreground">REGISTRY:</span>
          <span className="text-foreground">{DOCS_REGISTRY_HOST}</span>
        </div>
      </div>
    </Panel>
  );
}
