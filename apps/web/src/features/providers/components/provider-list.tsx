import type { Ref } from 'react';
import { NavigationList, NavigationListItem, Badge, Input } from '@stargazer/ui';
import { cn } from '@/utils/cn';
import { PROVIDER_CAPABILITIES } from '@/config/constants';
import { PROVIDER_FILTER_LABELS, type ProviderFilter } from '@/features/providers/constants';
import type { ProviderWithStatus, DisplayStatus } from '../types';

interface ProviderListProps {
  providers: ProviderWithStatus[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: (id: string) => void;
  filter: ProviderFilter;
  onFilterChange: (filter: ProviderFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isFocused?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  focusedFilterIndex?: number;
  listRef?: Ref<HTMLDivElement>;
  focusedValue?: string | null;
}

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
  selectedId,
  onSelect,
  onActivate,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  isFocused = true,
  inputRef,
  focusedFilterIndex,
  listRef,
  focusedValue,
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
            ref={inputRef}
            size="sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search providers..."
            className="pl-5"
          />
        </div>
      </div>

      <div className="px-3 py-2 border-b border-tui-border flex gap-1.5 flex-wrap">
        {PROVIDER_FILTER_LABELS.map((f, index) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilterChange(f.value)}
            className={cn(
              'px-2 py-0.5 text-[10px] cursor-pointer transition-colors',
              filter === f.value
                ? 'bg-tui-blue text-black font-bold'
                : 'border border-tui-border hover:border-tui-fg',
              focusedFilterIndex === index && 'ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <NavigationList
          ref={listRef}
          selectedId={selectedId}
          focusedValue={focusedValue}
          onSelect={onSelect}
          onActivate={onActivate}
          isFocused={isFocused}
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
                    className="text-[9px] inline-flex items-center leading-none"
                  >
                    {tierBadge}
                  </Badge>
                }
                subtitle={
                  !provider.model
                    ? "Select model"
                    : (provider.defaultModel || undefined)
                }
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
