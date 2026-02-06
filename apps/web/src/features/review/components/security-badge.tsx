import { cn } from "@/utils/cn";

export interface SecurityBadgeProps {
  type: "CWE" | "OWASP" | "CVE";
  code: string;
  className?: string;
}

export function SecurityBadge({ type, code, className }: SecurityBadgeProps) {
  return (
    <span className={cn("border border-tui-red text-tui-red text-[10px] px-1", className)}>
      {type}-{code}
    </span>
  );
}

export interface SecurityBadgeGroupProps {
  badges: Array<{ type: "CWE" | "OWASP" | "CVE"; code: string }>;
  className?: string;
}

export function SecurityBadgeGroup({ badges, className }: SecurityBadgeGroupProps) {
  if (badges.length === 0) return null;

  return (
    <div className={cn("flex gap-2", className)}>
      {badges.map((badge, i) => (
        <SecurityBadge key={`${badge.type}-${badge.code}-${i}`} type={badge.type} code={badge.code} />
      ))}
    </div>
  );
}
