'use client';

import {
  createContext,
  useContext,
  Children,
  isValidElement,
  Fragment,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/utils';
import { useKey } from '@/hooks/keyboard';

interface NavigationListItemData {
  id: string;
  disabled: boolean;
  index: number;
}

interface NavigationListContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: NavigationListItemData) => void;
  items: NavigationListItemData[];
}

interface NavigationListItemProps {
  id: string;
  disabled?: boolean;
  badge?: ReactNode;
  statusIndicator?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface NavigationListRootProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: NavigationListItemData) => void;
  keyboardEnabled?: boolean;
  className?: string;
  children: ReactNode;
}

const NavigationListContext = createContext<NavigationListContextValue | null>(null);

function useNavigationListContext() {
  const context = useContext(NavigationListContext);
  if (!context) {
    throw new Error('NavigationList.Item must be used within NavigationList');
  }
  return context;
}

function NavigationListItem({
  id,
  disabled = false,
  badge,
  statusIndicator,
  subtitle,
  children,
  className,
}: NavigationListItemProps) {
  const { selectedIndex, onSelect, onActivate, items } = useNavigationListContext();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isSelected = itemData.index === selectedIndex;

  const handleClick = () => {
    if (!disabled) {
      onSelect(itemData.index);
      onActivate?.(itemData);
    }
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        'flex cursor-pointer group',
        isSelected && 'bg-tui-fg text-black',
        !isSelected && 'hover:bg-tui-selection border-b border-tui-border/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div
        className={cn(
          'w-1 shrink-0',
          isSelected ? 'bg-tui-blue' : 'bg-transparent group-hover:bg-gray-700'
        )}
      />
      <div className="flex-1 p-3">
        <div className="flex justify-between items-start mb-1">
          <span className={cn('font-bold flex items-center', isSelected && 'text-black')}>
            <span className={cn('mr-2', !isSelected && 'opacity-0')}>▌</span>
            {children}
          </span>
          {statusIndicator && (
            <span className={cn('text-[10px] font-bold', isSelected ? 'text-black' : 'text-tui-yellow')}>
              {statusIndicator}
            </span>
          )}
        </div>
        {(badge || subtitle) && (
          <div className="flex gap-2 items-center">
            {badge}
            {subtitle && (
              <span className={cn('text-[9px]', isSelected ? 'text-black/70' : 'text-gray-500')}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NavigationListRoot({
  selectedIndex,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  className,
  children,
}: NavigationListRootProps) {
  const items: NavigationListItemData[] = [];
  let itemIndex = 0;

  function extractItems(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        extractItems((child.props as { children?: ReactNode }).children);
      } else if (child.type === NavigationListItem) {
        const props = child.props as NavigationListItemProps;
        items.push({
          id: props.id,
          disabled: props.disabled ?? false,
          index: itemIndex++,
        });
      }
    });
  }

  extractItems(children);

  const findNextIndex = (start: number, direction: 1 | -1): number => {
    let index = start + direction;
    while (index >= 0 && index < items.length) {
      if (!items[index]?.disabled) return index;
      index += direction;
    }
    return start;
  };

  useKey('ArrowUp', () => {
    const newIndex = findNextIndex(selectedIndex, -1);
    if (newIndex !== selectedIndex) onSelect(newIndex);
  }, { enabled: keyboardEnabled && items.length > 0 });

  useKey('ArrowDown', () => {
    const newIndex = findNextIndex(selectedIndex, 1);
    if (newIndex !== selectedIndex) onSelect(newIndex);
  }, { enabled: keyboardEnabled && items.length > 0 });

  useKey('k', () => {
    const newIndex = findNextIndex(selectedIndex, -1);
    if (newIndex !== selectedIndex) onSelect(newIndex);
  }, { enabled: keyboardEnabled && items.length > 0 });

  useKey('j', () => {
    const newIndex = findNextIndex(selectedIndex, 1);
    if (newIndex !== selectedIndex) onSelect(newIndex);
  }, { enabled: keyboardEnabled && items.length > 0 });

  useKey('Enter', () => {
    const item = items[selectedIndex];
    if (item && !item.disabled) onActivate?.(item);
  }, { enabled: keyboardEnabled });

  const contextValue: NavigationListContextValue = {
    selectedIndex,
    onSelect,
    onActivate,
    items,
  };

  return (
    <NavigationListContext.Provider value={contextValue}>
      <div role="listbox" className={cn('w-full', className)}>
        {children}
      </div>
    </NavigationListContext.Provider>
  );
}

export const NavigationList = NavigationListRoot;
export { NavigationListItem };

export type {
  NavigationListRootProps,
  NavigationListItemProps,
  NavigationListItemData,
};
