import { Logo } from "@/components/ui/logo"

export default function LogoFonts() {
  return (
    <div className="space-y-4">
      <Logo text="Big" font="Big" className="text-foreground text-[8px]" />
      <Logo text="Small" font="Small" className="text-success text-[10px]" />
    </div>
  )
}
