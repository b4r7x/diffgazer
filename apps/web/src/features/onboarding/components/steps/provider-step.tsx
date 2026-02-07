import { NavigationList, NavigationListItem } from "@/components/ui/navigation-list";
import { Badge } from "@/components/ui/badge";
import { AVAILABLE_PROVIDERS } from "@stargazer/schemas/config";
import type { AIProvider } from "@stargazer/schemas/config";
import { PROVIDER_CAPABILITIES } from "@/config/constants";

interface ProviderStepProps {
  value: AIProvider | null;
  onChange: (provider: AIProvider) => void;
}

export function ProviderStep({ value, onChange }: ProviderStepProps) {
  const handleSelect = (id: string) => {
    onChange(id as AIProvider);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Select an AI provider for code reviews.
      </p>
      <div className="border border-tui-border">
        <NavigationList
          selectedId={value}
          onSelect={handleSelect}
          onActivate={handleSelect}
        >
          {AVAILABLE_PROVIDERS.map((provider) => {
            const capabilities = PROVIDER_CAPABILITIES[provider.id];
            const tierBadge = capabilities?.tierBadge ?? "PAID";
            return (
              <NavigationListItem
                key={provider.id}
                id={provider.id}
                badge={
                  <Badge
                    variant={tierBadge === "FREE" ? "success" : "neutral"}
                    size="sm"
                    className="text-[9px]"
                  >
                    {tierBadge}
                  </Badge>
                }
                subtitle={provider.defaultModel || "Select model after setup"}
              >
                {provider.name}
              </NavigationListItem>
            );
          })}
        </NavigationList>
      </div>
    </div>
  );
}
