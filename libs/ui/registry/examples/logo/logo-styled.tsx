import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

function Case({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">{caption}</p>
      {children}
    </div>
  );
}

export default function LogoStyled() {
  return (
    <div className="space-y-4">
      <Case caption="Responsive sizing — text-[8px] → sm:text-2xs → md:text-xs">
        <Logo text="@diffgazer/ui" className="text-foreground text-[8px] sm:text-2xs md:text-xs" />
      </Case>
      <Case caption="Color override — text-error on a failure banner">
        <Logo text="error" className="text-error text-xs" />
      </Case>
      <Case caption="ASCII art — asciiText renders inside role=img">
        <Logo
          text="ok"
          asciiText={" ___  _  __\n/ _ \\| |/ /\n| | | | ' / \n| |_| | . \\ \n\\___/|_|\\_\\"}
          className="text-foreground text-2xs"
        />
      </Case>
    </div>
  );
}
