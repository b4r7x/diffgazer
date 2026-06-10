import { KeyValue } from "@diffgazer/ui/components/key-value";
import { Panel } from "@diffgazer/ui/components/panel";
import type { ReactNode } from "react";

export interface TuiFaultPanelProps {
  statusCode: string;
  statusValue?: string;
  title: string;
  description: string;
  detail?: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
}

export function TuiFaultPanel({
  statusCode,
  statusValue = "FAULT",
  title,
  description,
  detail,
  primaryAction,
  secondaryAction,
}: TuiFaultPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-2">
      <Panel frame="hairline" className="w-full max-w-3xl">
        <div className="flex flex-col gap-6 p-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {statusCode}
            </p>
            <h1 className="font-mono text-xl font-bold text-foreground">{title}</h1>
            <p className="mt-3 font-mono text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
            {detail ? (
              <pre className="mt-4 overflow-x-auto border border-border bg-[var(--tui-chrome-band-bg)] p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {detail}
              </pre>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">{primaryAction}</div>
            {secondaryAction ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">{secondaryAction}</div>
            ) : null}
          </div>
          <div
            aria-hidden="true"
            className="flex w-full flex-col justify-center border-t border-border pt-4 font-mono text-sm text-muted-foreground lg:w-56 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
          >
            <KeyValue className="gap-x-4">
              <KeyValue.Item label="STATUS:" value={statusValue} />
              <KeyValue.Item
                label="MODE:"
                value="RECOVER"
                valueClassName="font-normal text-muted-foreground"
              />
              <KeyValue.Item
                label="ACTION:"
                value="RETRY"
                labelClassName="mt-2 border-t border-dashed border-border pt-2"
                valueClassName="mt-2 border-t border-dashed border-border pt-2 font-normal"
              />
            </KeyValue>
          </div>
        </div>
      </Panel>
    </div>
  );
}
