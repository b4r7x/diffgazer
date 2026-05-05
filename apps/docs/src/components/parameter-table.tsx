interface Parameter {
  name: string
  type: string
  required?: boolean
  defaultValue?: string | null
  description?: string
}

export function ParameterTable({ params }: { params: Parameter[] }) {
  return (
    <div>
      {params.map((param, index) => (
        <div key={param.name}>
          {index > 0 && (
            <div className="w-full border-t border-border border-dashed opacity-50" />
          )}
          <div className="py-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-base font-bold text-foreground">{param.name}</span>
              <span className="text-xs text-muted-foreground font-mono">: {param.type}</span>
              {param.required && (
                <span className="px-1.5 py-0.5 border border-border text-[10px] text-muted-foreground rounded bg-background font-mono">
                  required
                </span>
              )}
              {param.defaultValue && (
                <span className="px-1.5 py-0.5 border border-border text-[10px] text-muted-foreground rounded bg-background font-mono">
                  default: {param.defaultValue}
                </span>
              )}
            </div>
            {param.description && (
              <p className="text-muted-foreground text-sm max-w-2xl">
                {param.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
