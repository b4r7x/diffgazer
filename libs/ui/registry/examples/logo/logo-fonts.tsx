import { Logo } from "@/components/ui/logo";

export default function LogoFonts() {
  return (
    <div className="space-y-4">
      <Logo
        text="DG"
        asciiText={" ____   ____ \n|  _ \\ / ___|\n| | | | |  _ \n| |_| | |_| |\n|____/ \\____|"}
        className="text-foreground text-2xs"
      />
      <Logo
        text="UI"
        asciiText={" _   _ ___ \n| | | |_ _|\n| | | || | \n| |_| || | \n \\___/|___|"}
        className="text-muted-foreground text-2xs"
      />
    </div>
  );
}
