import { Logo } from "@/components/ui/logo"

export default function LogoStyled() {
  return (
    <div className="space-y-4">
      <Logo text="@diffgazer/ui" className="text-foreground text-[6px] sm:text-[8px] md:text-[10px]" />
      <Logo text="error" className="text-destructive text-[8px]" />
      <Logo text="ok" font="Small" className="text-success text-[10px]" />
    </div>
  )
}
