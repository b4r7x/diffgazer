import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { NavigationList, NavigationListItem, NavigationListTitle, NavigationListBadge, NavigationListSubtitle, NavigationListStatus } from 'diffui/components/navigation-list';
import { Input } from 'diffui/components/input';
import { cn } from 'diffui/lib/utils';
import { getDisplayStatusBadge } from '@diffgazer/core/providers';
import { PROVIDER_CAPABILITIES } from '@diffgazer/schemas/config';
import { PROVIDER_FILTER_LABELS, type ProviderFilter } from '@/features/providers/constants';
import type { ProviderWithStatus } from '@diffgazer/schemas/config';

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
  highlightedId?: string | null;
  onHighlightChange?: (id: string) => void;
  onBoundaryReached?: (direction: "up" | "down") => void;
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
  highlightedId,
  onHighlightChange,
  onBoundaryReached,
}: ProviderListProps) {
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (!onBoundaryReached || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const providerIds = providers.map((p) => p.id);
    const isAtStart = highlightedId === providerIds[0];
    const isAtEnd = highlightedId === providerIds[providerIds.length - 1];
    if (e.key === "ArrowUp" && isAtStart) {
      e.preventDefault();
      onBoundaryReached("up");
    } else if (e.key === "ArrowDown" && isAtEnd) {
      e.preventDefault();
      onBoundaryReached("down");
    }
  };

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
          selectedId={selectedId}
          highlightedId={highlightedId}
          onHighlightChange={onHighlightChange}
          onSelect={(id) => {
            onSelect(id);
            onActivate?.(id);
          }}
          focused={isFocused}
          wrap={false}
          onKeyDown={handleKeyDown}
        >
          {providers.map((provider) => {
            const capabilities = PROVIDER_CAPABILITIES[provider.id];
            const tierBadge = capabilities?.tierBadge ?? 'PAID';
            const badge = getDisplayStatusBadge(provider.displayStatus);
            const statusText = `[${badge.label.toUpperCase()}]`;
            const subtitleText = !provider.model
              ? "Select model"
              : (provider.defaultModel || undefined);

            return (
              <NavigationListItem
                key={provider.id}
                id={provider.id}
                className={cn(
                  'border-l-2 border-l-transparent',
                  !isFocused && selectedId === provider.id && 'border-l-tui-blue/60 text-tui-fg'
                )}
              >
                <NavigationListTitle>{provider.name}</NavigationListTitle>
                {statusText && <NavigationListStatus>{statusText}</NavigationListStatus>}
                <NavigationListBadge
                  variant={tierBadge === 'FREE' ? 'success' : 'neutral'}
                  className="text-[9px]"
                >
                  {tierBadge}
                </NavigationListBadge>
                {subtitleText && <NavigationListSubtitle>{subtitleText}</NavigationListSubtitle>}
              </NavigationListItem>
            );
          })}
        </NavigationList>
      </div>
    </div>
  );
}
