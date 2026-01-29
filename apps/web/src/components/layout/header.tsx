import { cn } from "../../lib/utils";
import { AsciiLogo } from "../ui/ascii-logo";

type ProviderStatus = "active" | "idle" | "error";

interface HeaderProps {
  providerName?: string;
  providerStatus?: ProviderStatus;
  subtitle?: string;
}

export function Header({
  providerName = "Not configured",
  providerStatus = "idle",
  subtitle,
}: HeaderProps) {
  return (
    <header className="relative p-4 pb-2 shrink-0">
      {/* Provider status - top right */}
      <div className="absolute top-4 right-4 text-xs">
        <span className="text-gray-500">●</span> {providerName}{" "}
        <span className="text-gray-500">•</span>{" "}
        <span className="text-gray-500 capitalize">{providerStatus}</span>
      </div>

      {/* Centered content */}
      <div className="flex flex-col items-center pt-4 md:pt-6">
        <AsciiLogo
          text="stargazer"
          className={cn(
            "text-tui-blue font-bold whitespace-pre leading-none select-none",
            "text-[8px] md:text-[10px] lg:text-xs",
            "[zoom:0.8] md:[zoom:1] lg:[zoom:1.2]",
          )}
        />

        {subtitle && (
          <div className="mt-2 text-center text-gray-500 text-xs">
            {subtitle}
          </div>
        )}

        <div className="text-center text-gray-600 text-sm select-none">
          ─ ✦ ─ ✧ ─
        </div>
      </div>
    </header>
  );
}
