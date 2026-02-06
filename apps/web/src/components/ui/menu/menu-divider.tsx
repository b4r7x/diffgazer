import { cn } from "@/utils/cn";

export interface MenuDividerProps {
  className?: string;
}

export function MenuDivider({ className }: MenuDividerProps) {
  return <div className={cn("my-1 border-t border-tui-border mx-4 opacity-50", className)} />;
}
