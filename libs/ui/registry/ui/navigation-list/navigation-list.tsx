"use client";

import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import {
  collectListboxItems,
  getEncodedListboxItemId,
  type ListboxMetadataItem,
  useListbox,
} from "@/hooks/use-listbox";
import { isSelectableItemEligible, useSelectableCollection } from "@/lib/selectable-collection";
import { cn } from "@/lib/utils";
import { warnUnregisteredValue } from "@/lib/warn-unregistered-value";
import {
  type GroupHeaderRegistration,
  NavigationListContext,
  type NavigationListIndicator,
} from "./navigation-list-context";
import { NavigationListGroup } from "./navigation-list-group";
import { NavigationListItem } from "./navigation-list-item";

/** Props for navigation list. */
export interface NavigationListProps
  extends Omit<ComponentPropsWithRef<"div">, "children" | "onKeyDown" | "onSelect"> {
  /** Controlled selected item id. */
  selectedId?: string | null;
  /** Initial selected id for uncontrolled mode. */
  defaultSelectedId?: string | null;
  /** Controlled highlighted (focused) item id. */
  highlighted?: string | null;
  /** Initial highlighted id for uncontrolled mode. */
  defaultHighlighted?: string | null;
  /** Fired when an item is activated by click, Enter, or Space — including the already-selected item. */
  onSelect?: (id: string) => void;
  /**
   * Fired when Enter activates an item. Receives the raw keyboard event for modifier-key
   * handling.
   */
  onEnter?: (id: string, event: globalThis.KeyboardEvent) => void;
  /** Fired when the highlighted item changes. */
  onHighlightChange?: (id: string | null) => void;
  /**
   * Fired when arrow navigation reaches the first/last item with wrap disabled, enabling
   * cross-list navigation.
   */
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  /** Visual indicator style for the active/selected item. */
  indicator?: NavigationListIndicator;
  /**
   * When false, removes the active visual treatment from the selected/highlighted item (useful
   * when focus is elsewhere).
   */
  focused?: boolean;
  /** When true, arrow navigation wraps at list boundaries. */
  wrap?: boolean;
  /** Auto-focus the list on mount. */
  autoFocus?: boolean;
  /** NavigationList.Item children. */
  children: ReactNode;
  /** Called when key down occurs. */
  onKeyDown?: (event: KeyboardEvent) => void;
}

/**
 * Terminal-styled navigation sidebar list with selection, keyboard navigation, and composable
 * item parts.
 */
export function NavigationList({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlighted: controlledHighlighted,
  defaultHighlighted = null,
  onSelect,
  onEnter,
  onHighlightChange,
  onNavigationBoundaryReached,
  indicator = "bar",
  focused = true,
  wrap = true,
  autoFocus = false,
  className,
  children,
  onKeyDown,
  "aria-label": ariaLabel,
  ref,
  ...rootProps
}: NavigationListProps) {
  const idPrefix = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const composedRef = useComposedRefs(containerRef, ref);
  const groupHeadersRef = useRef<Map<string, GroupHeaderRegistration>>(new Map());
  const [registrationsStarted, setRegistrationsStarted] = useState(false);
  const {
    items: registeredItems,
    registerItem,
    unregisterItem,
  } = useSelectableCollection(containerRef);
  const registeredMetadata = useMemo<ListboxMetadataItem[]>(
    () =>
      registeredItems.map((item) => ({
        id: item.value,
        disabled: !isSelectableItemEligible(item),
      })),
    [registeredItems],
  );
  const renderSeed = useMemo(
    () =>
      collectListboxItems(children, {
        itemTypes: [NavigationListItem],
        containerTypes: [NavigationListGroup],
      }),
    [children],
  );
  const items = registrationsStarted ? registeredMetadata : renderSeed;

  const handleRegisterItem = useCallback(
    (registrationId: string, value: string, disabled: boolean, element: HTMLElement | null) => {
      setRegistrationsStarted(true);
      registerItem(registrationId, value, disabled, element);
    },
    [registerItem],
  );

  const handleGroupKeyDown = useCallback(
    (event: KeyboardEvent) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      const key = event.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Enter" && key !== " ") return;

      const container = containerRef.current;
      if (!container) return;
      const activeId = container.getAttribute("aria-activedescendant");
      if (!activeId) return;

      const activeEl = container.ownerDocument.getElementById(activeId);
      if (!activeEl) return;
      const itemValue = activeEl.dataset.value;
      if (!itemValue) return;

      const registration = groupHeadersRef.current.get(itemValue);
      if (!registration) return;

      if (key === "ArrowRight") {
        if (!registration.expanded) {
          event.preventDefault();
          registration.toggle();
        }
        return;
      }

      if (key === "ArrowLeft") {
        if (registration.expanded) {
          event.preventDefault();
          registration.toggle();
        }
        return;
      }

      if (key === "Enter" || key === " ") {
        event.preventDefault();
        registration.toggle();
      }
    },
    [onKeyDown],
  );

  const { selectedId, highlighted, handleItemActivate, handleItemHighlight, getContainerProps } =
    useListbox({
      selectedId: controlledSelectedId,
      defaultSelectedId,
      highlighted: controlledHighlighted,
      defaultHighlighted,
      onSelect,
      onEnter,
      onHighlightChange,
      onNavigationBoundaryReached,
      wrap,
      idPrefix,
      autoFocus,
      onKeyDown: handleGroupKeyDown,
      typeahead: true,
      items,
      getItemId: getEncodedListboxItemId,
      ref: composedRef,
    });

  const wrappedActivate = useCallback(
    (id: string) => {
      warnUnregisteredValue(
        "NavigationList",
        id,
        items.map((item) => item.id),
      );
      handleItemActivate(id);
    },
    [handleItemActivate, items],
  );

  const registerGroupHeader = useCallback((id: string, registration: GroupHeaderRegistration) => {
    groupHeadersRef.current.set(id, registration);
  }, []);

  const unregisterGroupHeader = useCallback((id: string) => {
    groupHeadersRef.current.delete(id);
  }, []);

  const contextValue = useMemo(
    () => ({
      selectedId,
      highlighted,
      activate: wrappedActivate,
      highlight: handleItemHighlight,
      focusContainer: () => containerRef.current?.focus(),
      focused,
      idPrefix,
      indicator,
      registerItem: handleRegisterItem,
      unregisterItem,
      registerGroupHeader,
      unregisterGroupHeader,
    }),
    [
      selectedId,
      highlighted,
      wrappedActivate,
      handleItemHighlight,
      focused,
      idPrefix,
      indicator,
      handleRegisterItem,
      unregisterItem,
      registerGroupHeader,
      unregisterGroupHeader,
    ],
  );

  return (
    <NavigationListContext value={contextValue}>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: getContainerProps applies role="listbox" dynamically, which Biome cannot resolve; aria-label and aria-orientation are valid for the listbox role. */}
      <div
        {...rootProps}
        {...getContainerProps()}
        data-slot="navigation-list"
        aria-label={ariaLabel}
        aria-orientation="vertical"
        className={cn("w-full outline-none", className)}
      >
        {children}
      </div>
    </NavigationListContext>
  );
}
