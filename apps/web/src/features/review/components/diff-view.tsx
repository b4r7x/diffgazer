
import { cn } from "@/lib/utils"

interface DiffViewProps {
    patch?: string
    className?: string
}

export function DiffView({ patch, className }: DiffViewProps) {
    if (!patch) return null

    const lines = patch.split('\n')

    return (
        <div className={cn("rounded-md border font-mono text-sm overflow-x-auto bg-background", className)}>
            {lines.map((line, i) => {
                const isAdd = line.startsWith('+')
                const isDel = line.startsWith('-')
                // Header usually starts with @@ or similar
                const isHeader = line.startsWith('@@')

                return (
                    <div key={i} className={cn(
                        "flex min-w-full w-max",
                        isAdd && "bg-green-500/10 text-green-700 dark:text-green-400",
                        isDel && "bg-red-500/10 text-red-700 dark:text-red-400",
                        isHeader && "bg-muted text-muted-foreground"
                    )}>
                        <div className="w-8 shrink-0 select-none opacity-50 text-right pr-2 text-xs py-0.5 border-r border-border/50 bg-muted/30">
                            {/* Could calculate line numbers here if generic context provided */}
                            {/* For now just symbol */}
                            {isAdd ? '+' : isDel ? '-' : ''}
                        </div>
                        <div className="whitespace-pre py-0.5 px-2">
                            {/* Remove the first character if it's a diff marker +/-, but keep for header/context */}
                            {(isAdd || isDel) ? line.substring(1) : line}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
