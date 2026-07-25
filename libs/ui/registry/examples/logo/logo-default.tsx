import { Logo } from "@/components/ui/logo";

const DG_MARK = " ____   ____ \n|  _ \\ / ___|\n| | | | |  _ \n| |_| | |_| |\n|____/ \\____|";

export default function LogoDefault() {
  return (
    <div className="space-y-6">
      <Logo text="DG" asciiText={DG_MARK} className="text-foreground text-sm" />
      <Logo text="diffgazer" className="text-foreground" />
    </div>
  );
}
