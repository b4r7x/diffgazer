import type { PropInfo } from "@/types/docs-data"

interface PropsTableProps {
  componentName: string
  props: Record<string, PropInfo>
}

export function PropsTable({ componentName, props }: PropsTableProps) {
  const propEntries = Object.entries(props)
  if (propEntries.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-foreground">{componentName}</h2>
        <span className="h-px bg-border flex-1" />
      </div>

      <div>
        {propEntries.map(([name, info], index) => (
          <div key={name}>
            {index > 0 && (
              <div className="w-full border-t border-border border-dashed opacity-50" />
            )}
            <div className="py-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-base font-bold text-foreground">{name}</span>
                <span className="text-xs text-muted-foreground font-mono">: {info.type}</span>
                {info.required && (
                  <span className="px-1.5 py-0.5 border border-border text-[10px] text-muted-foreground rounded bg-background font-mono">
                    required
                  </span>
                )}
                {info.defaultValue && (
                  <span className="px-1.5 py-0.5 border border-border text-[10px] text-muted-foreground rounded bg-background font-mono">
                    default: {info.defaultValue}
                  </span>
                )}
              </div>
              {info.description && (
                <p className="text-muted-foreground text-sm font-sans max-w-2xl mb-4">
                  {info.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
