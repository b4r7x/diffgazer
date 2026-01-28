'use client';

import { NavigationList, NavigationListItem } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ProviderInfo, ProviderStatus } from '@repo/schemas';
import { PROVIDER_CAPABILITIES } from '@repo/schemas';

type DisplayStatus = 'configured' | 'needs-key' | 'active';

export interface ProviderWithStatus extends ProviderInfo {
  displayStatus: DisplayStatus;
}

export type ProviderFilter = 'all' | 'configured' | 'needs-key' | 'free' | 'paid';

interface ProviderListProps {
  providers: ProviderWithStatus[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (item: { id: string }) => void;
  filter: ProviderFilter;
  onFilterChange: (filter: ProviderFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  keyboardEnabled?: boolean;
}

const FILTERS: { value: ProviderFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'configured', label: 'Configured' },
  { value: 'needs-key', label: 'Needs Key' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
];

function getStatusIndicator(status: DisplayStatus): string | undefined {
  switch (status) {
    case 'active':
      return '[ACTIVE]';
    case 'configured':
      return '[READY]';
    case 'needs-key':
      return '[NEEDS KEY]';
  }
}

export function ProviderList({
  providers,
  selectedIndex,
  onSelect,
  onActivate,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  keyboardEnabled = true,
}: ProviderListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-tui-border bg-tui-selection/30">
        <h2 className="text-sm font-bold text-tui-fg uppercase tracking-wide">
          Providers
        </h2>
      </div>

      <div className="p-3 border-b border-tui-border">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-tui-muted text-xs">
            /
          </span>
          <Input
            size="sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search providers..."
            className="pl-5"
          />
        </div>
      </div>

      <div className="px-3 py-2 border-b border-tui-border flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilterChange(f.value)}
            className={cn(
              'px-2 py-0.5 text-[10px] cursor-pointer transition-colors',
              filter === f.value
                ? 'bg-tui-blue text-black font-bold'
                : 'border border-tui-border hover:border-tui-fg'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <NavigationList
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onActivate={onActivate}
          keyboardEnabled={keyboardEnabled}
        >
          {providers.map((provider) => {
            const capabilities = PROVIDER_CAPABILITIES[provider.id];
            const tierBadge = capabilities?.tierBadge ?? 'PAID';

            return (
              <NavigationListItem
                key={provider.id}
                id={provider.id}
                statusIndicator={getStatusIndicator(provider.displayStatus)}
                badge={
                  <Badge
                    variant={tierBadge === 'FREE' ? 'success' : 'neutral'}
                    size="sm"
                    className="text-[9px]"
                  >
                    {tierBadge}
                  </Badge>
                }
                subtitle={provider.model ?? provider.defaultModel}
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
