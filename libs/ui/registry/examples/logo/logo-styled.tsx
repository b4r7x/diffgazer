import { Logo } from "@/components/ui/logo";

export default function LogoStyled() {
  return (
    <div className="space-y-4">
      <Logo text="@diffgazer/ui" className="text-foreground text-[6px] sm:text-[8px] md:text-2xs" />
      <Logo text="error" className="text-error text-[8px]" />
      <Logo
        text="ok"
        asciiText={" ___  _  __\n/ _ \\| |/ /\n| | | | ' / \n| |_| | . \\ \n\\___/|_|\\_\\"}
        className="text-success text-2xs"
      />
    </div>
  );
}
