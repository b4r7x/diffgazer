import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from 'react';
import { NavigationList, NavigationListItem, NavigationListTitle, NavigationListBadge, NavigationListMeta, NavigationListSubtitle, NavigationListStatus } from '@diffgazer/ui/components/navigation-list';
import { InputGroup } from '@diffgazer/ui/components/input';
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { cn } from "@diffgazer/core/cn";
import { getDisplayStatusBadge } from '@diffgazer/core/providers';
import { PROVIDER_CAPABILITIES } from '@diffgazer/core/schemas/config';
import { PROVIDER_FILTER_LABELS, type ProviderFilter } from '@/features/providers/constants';
import type { ProviderWithStatus } from '@diffgazer/core/schemas/config';

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
  onSearchFocus?: () => void;
  focusedFilterIndex?: number;
  onFilterHighlightChange?: (index: number) => void;
  onFilterFocus?: (index: number) => void;
  onFilterKeyDown?: (event: ReactKeyboardEvent) => void;
  getFilterButtonProps?: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  highlightedId?: string | null;
  onHighlightChange?: (id: string) => void;
  onBoundaryReached?: (direction: "up" | "down") => void;
  ref?: React.Ref<HTMLDivElement>;
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
  onSearchFocus,
  focusedFilterIndex,
  onFilterHighlightChange,
  onFilterFocus,
  onFilterKeyDown,
  getFilterButtonProps,
  highlightedId,
  onHighlightChange,
  onBoundaryReached,
  ref,
}: ProviderListProps) {
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (!onBoundaryReached || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const providerIds = providers.map((p) => p.id);
    const activeId = highlightedId ?? selectedId;
    const isAtStart = activeId === providerIds[0];
    const isAtEnd = activeId === providerIds[providerIds.length - 1];
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
        <InputGroup
          ref={inputRef}
          size="sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onSearchFocus}
          aria-label="Search providers"
          placeholder="Search providers..."
          prefix={<span aria-hidden="true">/</span>}
        />
      </div>

      <ToggleGroup
        value={filter}
        onChange={(value) => {
          const index = PROVIDER_FILTER_LABELS.findIndex((item) => item.value === value);
          if (index === -1) return;
          const nextFilter = PROVIDER_FILTER_LABELS[index]?.value;
          if (!nextFilter) return;
          onFilterFocus?.(index);
          onFilterHighlightChange?.(index);
          onFilterChange(nextFilter);
        }}
        onHighlightChange={(value) => {
          const index = PROVIDER_FILTER_LABELS.findIndex((item) => item.value === value);
          if (index >= 0) {
            onFilterFocus?.(index);
            onFilterHighlightChange?.(index);
          }
        }}
        highlighted={
          focusedFilterIndex === undefined
            ? null
            : (PROVIDER_FILTER_LABELS[focusedFilterIndex]?.value ?? null)
        }
        onKeyDown={onFilterKeyDown}
        className="px-3 py-2 border-b border-tui-border"
        label="Provider filter"
      >
        {PROVIDER_FILTER_LABELS.map((f, index) => {
          const filterButtonProps = getFilterButtonProps?.(index);

          return (
            <ToggleGroupItem
              key={f.value}
              value={f.value}
              ref={filterButtonProps?.ref}
              onFocus={() => {
                filterButtonProps?.onFocus();
                onFilterFocus?.(index);
              }}
              className={cn(
                "min-h-0 min-w-0 px-2 py-0.5 text-[10px]",
                focusedFilterIndex === index && 'ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg'
              )}
            >
              {f.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <NavigationList
          ref={ref}
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
                <div className="col-span-full row-start-2 flex min-w-0 items-center gap-2">
                  <NavigationListMeta className="shrink-0">
                    <NavigationListBadge
                      variant={tierBadge === 'FREE' ? 'success' : 'neutral'}
                      className="shrink-0 text-[9px]"
                    >
                      {tierBadge}
                    </NavigationListBadge>
                  </NavigationListMeta>
                  {subtitleText && (
                    <NavigationListSubtitle className="min-w-0 truncate">
                      {subtitleText}
                    </NavigationListSubtitle>
                  )}
                </div>
              </NavigationListItem>
            );
          })}
        </NavigationList>
      </div>
    </div>
  );
}
