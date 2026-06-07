import { Typography } from "@diffgazer/ui/components/typography";

interface Parameter {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string | null;
  description?: string;
}

export function ParameterTable({ params }: { params: Parameter[] }) {
  const badgeClass =
    "px-1.5 py-0.5 border border-border text-[10px] text-muted-foreground rounded bg-background font-mono";

  return (
    <div>
      {params.map((param, index) => (
        <div key={param.name}>
          {index > 0 && <div className="w-full border-t border-border border-dashed opacity-50" />}
          <div className="py-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Typography as="span" size="base" className="font-bold text-foreground">
                {param.name}
              </Typography>
              <span className="text-xs text-muted-foreground font-mono">: {param.type}</span>
              {param.required && <span className={badgeClass}>required</span>}
              {param.defaultValue != null && (
                <span className={badgeClass}>default: {param.defaultValue}</span>
              )}
            </div>
            {param.description && (
              <Typography as="p" size="sm" className="max-w-2xl">
                {param.description}
              </Typography>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
