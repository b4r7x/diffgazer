import { Badge } from "@/components/ui/badge"

interface SeverityBadgeProps {
    severity: "blocker" | "high" | "medium" | "low" | "nit"
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
    const emoji = {
        blocker: "🔴",
        high: "🟠",
        medium: "🟡",
        low: "🔵",
        nit: "⚪",
    }[severity]

    return (
        <Badge variant={severity} className="gap-1.5">
            <span>{emoji}</span>
            <span className="capitalize">{severity}</span>
        </Badge>
    )
}
