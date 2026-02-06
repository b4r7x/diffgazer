import { Fragment } from "react";

interface PathListProps {
  title: string;
  paths: Record<string, string>;
  labelWidth?: string;
}

export function PathList({ title, paths, labelWidth = "80px" }: PathListProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-tui-violet font-bold text-xs uppercase tracking-wider">
        {title}
      </h3>
      <div className="grid gap-2 text-sm font-mono" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
        {Object.entries(paths).map(([label, path]) => (
          <Fragment key={label}>
            <span className="text-tui-muted text-right">{label}:</span>
            <span className="text-tui-fg">{path}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
