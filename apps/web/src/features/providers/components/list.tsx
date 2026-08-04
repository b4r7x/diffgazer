import type { ProviderDisplayStatus, ProviderListRow } from "@diffgazer/core/providers";
import {
  BILLING_TIER_BADGES,
  getBillingTier,
  getProviderDisplayStatus,
  getProviderRowId,
} from "@diffgazer/core/providers";
import type { BadgeVariant } from "@diffgazer/core/schemas/presentation";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import {
  NavigationList,
  NavigationListBadge,
  NavigationListItem,
  NavigationListMeta,
  NavigationListStatus,
  NavigationListSubtitle,
  NavigationListTitle,
} from "@diffgazer/ui/components/navigation-list";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SearchInput } from "@diffgazer/ui/components/search-input";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { cn } from "@diffgazer/ui/lib/utils";
import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from "react";
import { PROVIDER_FILTER_LABELS, type ProviderFilter } from "../lib/filter";
import { PROVIDER_STATUS_TONE } from "../lib/status-tone";

interface ProviderListProps {
  providers: ProviderListRow[];
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
  onFilterIndexChange?: (index: number) => void;
  onFilterKeyDown?: (event: ReactKeyboardEvent) => void;
  getFilterButtonProps?: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
  };
  onListKeyDown?: (event: ReactKeyboardEvent) => void;
  highlighted?: string | null;
  onHighlightChange?: (id: string | null) => void;
  onBoundaryReached?: (direction: "up" | "down") => void;
  ref?: React.Ref<HTMLDivElement>;
}

function getStatusTone(status: ProviderDisplayStatus): BadgeVariant {
  // A provider nobody has set up yet is an empty slot rather than a problem, so
  // the list reads it muted grey; every other state follows its display variant.
  if (status.status === "unconfigured") return "neutral";
  return status.variant;
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
  onFilterIndexChange,
  onFilterKeyDown,
  getFilterButtonProps,
  onListKeyDown,
  highlighted,
  onHighlightChange,
  onBoundaryReached,
  ref,
}: ProviderListProps) {
  const renderRow = (row: ProviderListRow) => {
    const rowId = getProviderRowId(row);
    const tierBadge = BILLING_TIER_BADGES[getBillingTier(row.product.productId)];
    const status = getProviderDisplayStatus(row.readiness, row.product.transportFamily);
    const tone = getStatusTone(status);
    const subtitle = row.configuration?.selectedModelId ?? null;

    return (
      <NavigationListItem
        key={rowId}
        id={rowId}
        className={cn(
          "border-l-2 border-l-transparent",
          !isFocused && selectedId === rowId && "border-l-info/60 text-foreground",
        )}
      >
        <NavigationListTitle>{row.product.name}</NavigationListTitle>
        <NavigationListStatus
          role="img"
          aria-label={status.accessibleText}
          data-tone={tone}
          className={PROVIDER_STATUS_TONE[tone]}
        >
          {`[ ${status.label.toUpperCase()} ]`}
        </NavigationListStatus>
        <div className="col-span-full row-start-2 flex min-w-0 items-center gap-2">
          <NavigationListMeta className="shrink-0">
            <NavigationListBadge variant={tierBadge.variant} className="shrink-0 text-3xs">
              {tierBadge.label}
            </NavigationListBadge>
          </NavigationListMeta>
          {subtitle ? (
            // /85 lifts the slug over the AA floor on the selection fill, the
            // same override history applies to its run summaries.
            <NavigationListSubtitle className="min-w-0 truncate group-data-[highlighted]:text-primary-foreground/85">
              {subtitle}
            </NavigationListSubtitle>
          ) : null}
        </div>
      </NavigationListItem>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* pt-4 keeps the search box clear of the notched PROVIDERS chip above it. */}
      <div className="px-3 pb-3 pt-4 border-b border-border">
        <SearchInput
          ref={inputRef}
          size="md"
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
          if (value === null) return;
          onFilterChange(value);
        }}
        highlighted={
          focusedFilterIndex === undefined
            ? null
            : (PROVIDER_FILTER_LABELS[focusedFilterIndex]?.value ?? null)
        }
        onKeyDown={onFilterKeyDown}
        className="w-full px-3 py-2 border-b border-border"
        label="Provider filter"
      >
        {PROVIDER_FILTER_LABELS.map((f, index) => (
          <ToggleGroupItem
            key={f.value}
            value={f.value}
            ref={getFilterButtonProps?.(index).ref}
            // Focus is the one signal that hands the filter row the keyboard
            // zone: arrow navigation, Tab, and pointer focus all land here.
            onFocus={() => onFilterIndexChange?.(index)}
            className="h-6 min-h-0 px-2.5 text-2xs uppercase pointer-coarse:min-h-11 pointer-coarse:px-3"
          >
            {f.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ScrollArea
        keyboardScrollable={false}
        className="flex-1 pb-2 max-md:overflow-x-visible max-md:overflow-y-visible"
      >
        {providers.length > 0 ? (
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
            {providers.map(renderRow)}
          </NavigationList>
        ) : null}
        <EmptyState
          variant="inline"
          size="sm"
          live
          className={providers.length > 0 ? "sr-only p-0" : "h-full"}
        >
          {providers.length === 0 ? "No providers match your filters" : null}
        </EmptyState>
      </ScrollArea>
    </div>
  );
}
