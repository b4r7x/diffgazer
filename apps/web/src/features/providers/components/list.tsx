import { getDisplayStatusBadge, PROVIDER_FILTER_LABELS, type ProviderFilter } from '@diffgazer/core/providers';
import type { ProviderWithStatus } from '@diffgazer/core/schemas/config';
import { PROVIDER_CAPABILITIES } from '@diffgazer/core/schemas/config';
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { EmptyState } from '@diffgazer/ui/components/empty-state';
import { NavigationList, NavigationListBadge, NavigationListItem, NavigationListMeta, NavigationListStatus, NavigationListSubtitle, NavigationListTitle } from '@diffgazer/ui/components/navigation-list';
import { SearchInput } from '@diffgazer/ui/components/search-input';
import { SectionHeader } from '@diffgazer/ui/components/section-header';
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { cn } from "@diffgazer/ui/lib/utils";
import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from 'react';

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
  onSearchEscape?: () => void;
  onListFocus?: () => void;
  focusedFilterIndex?: number;
  onFilterHighlightChange?: (index: number) => void;
  onFilterFocus?: (index: number) => void;
  onFilterKeyDown?: (event: ReactKeyboardEvent) => void;
  getFilterButtonProps?: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  onListKeyDown?: (event: ReactKeyboardEvent) => void;
  highlighted?: string | null;
  onHighlightChange?: (id: string | null) => void;
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
  onSearchEscape,
  onListFocus,
  focusedFilterIndex,
  onFilterHighlightChange,
  onFilterFocus,
  onFilterKeyDown,
  getFilterButtonProps,
  onListKeyDown,
  highlighted,
  onHighlightChange,
  onBoundaryReached,
  ref,
}: ProviderListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-tui-border bg-tui-selection/30">
        <SectionHeader as="h2" className="mb-0 text-tui-fg">
          Providers
        </SectionHeader>
      </div>

      <div className="p-3 border-b border-tui-border">
        <SearchInput
          ref={inputRef}
          size="sm"
          value={searchQuery}
          onChange={onSearchChange}
          onFocus={onSearchFocus}
          onEscape={onSearchEscape}
          aria-label="Search providers"
          placeholder="Search providers..."
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
          if (value === null) return;
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
              className="min-h-0 min-w-0 px-2 py-0.5 text-2xs"
            >
              {f.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {providers.length === 0 ? (
          <EmptyState variant="inline" size="sm" live className="h-full">
            No providers match your filters
          </EmptyState>
        ) : (
          <NavigationList
            ref={ref}
            aria-label="Providers"
            selectedId={selectedId}
            highlighted={highlighted}
            onFocus={onListFocus}
            onHighlightChange={onHighlightChange}
            onKeyDown={onListKeyDown}
            onSelect={onSelect}
            onEnter={(id) => onActivate?.(id)}
            focused={isFocused}
            wrap={false}
            onNavigationBoundaryReached={(direction) => {
              onBoundaryReached?.(toVerticalBoundaryDirection(direction));
            }}
          >
            {providers.map((provider) => {
              const capabilities = PROVIDER_CAPABILITIES[provider.id];
              const tierBadge = capabilities?.tierBadge ?? 'PAID';
              const badge = getDisplayStatusBadge(provider.displayStatus);
              const statusText = `[${badge.label.toUpperCase()}]`;
              const subtitleText = !provider.model
                ? "Select model"
                : (provider.model || undefined);

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
                        className="shrink-0 text-3xs"
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
        )}
      </div>
    </div>
  );
}
