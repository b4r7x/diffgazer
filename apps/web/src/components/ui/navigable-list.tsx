'use client';

import {
  createContext,
  useContext,
  useEffect,
  Children,
  isValidElement,
  Fragment,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/utils';

interface NavigableItem {
  id: string;
  disabled: boolean;
  index: number;
}

type RenderState = { isSelected: boolean; isDisabled: boolean; index: number };

interface NavigableListContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: NavigableItem) => void;
  items: NavigableItem[];
}

interface NavigableListItemProps {
  id: string;
  disabled?: boolean;
  children: ReactNode | ((state: RenderState) => ReactNode);
  className?: string;
}

interface NavigableListRootProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: { id: string; disabled: boolean; index: number }) => void;
  keyboardEnabled?: boolean;
  enableNumberJump?: boolean;
  className?: string;
  children: ReactNode;
}

const NavigableListContext = createContext<NavigableListContextValue | null>(null);

function useNavigableListContext() {
  const context = useContext(NavigableListContext);
  if (!context) {
    throw new Error('NavigableList.Item must be used within NavigableList');
  }
  return context;
}

function NavigableListItem({
  id,
  disabled = false,
  children,
  className,
}: NavigableListItemProps) {
  const { selectedIndex, onSelect, onActivate, items } = useNavigableListContext();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isSelected = itemData.index === selectedIndex;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      className={cn(
        'w-full cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      onClick={() => {
        if (!disabled) {
          onSelect(itemData.index);
          onActivate?.(itemData);
        }
      }}
      data-selected={isSelected}
      data-disabled={disabled}
      data-index={itemData.index}
    >
      {typeof children === 'function'
        ? children({ isSelected, isDisabled: disabled, index: itemData.index })
        : children}
    </div>
  );
}

function NavigableListRoot({
  selectedIndex,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  enableNumberJump = false,
  className,
  children,
}: NavigableListRootProps) {
  const items: NavigableItem[] = [];
  let itemIndex = 0;

  function extractItems(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        extractItems(child.props.children);
      } else if (child.type === NavigableListItem) {
        const props = child.props as NavigableListItemProps;
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

  useEffect(() => {
    if (!keyboardEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp': {
          event.preventDefault();
          const newIndex = findNextIndex(selectedIndex, -1);
          if (newIndex !== selectedIndex) onSelect(newIndex);
          break;
        }
        case 'ArrowDown': {
          event.preventDefault();
          const newIndex = findNextIndex(selectedIndex, 1);
          if (newIndex !== selectedIndex) onSelect(newIndex);
          break;
        }
        case 'Enter': {
          event.preventDefault();
          const item = items[selectedIndex];
          if (item && !item.disabled) onActivate?.(item);
          break;
        }
        default: {
          if (!enableNumberJump) break;
          const num = parseInt(event.key, 10);
          if (num >= 1 && num <= 9) {
            const index = num - 1;
            const item = items[index];
            if (item && !item.disabled) {
              onSelect(index);
              onActivate?.(item);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, selectedIndex, items, enableNumberJump, onSelect, onActivate]);

  const contextValue: NavigableListContextValue = {
    selectedIndex,
    onSelect,
    onActivate,
    items,
  };

  return (
    <NavigableListContext.Provider value={contextValue}>
      <div role="listbox" className={cn('space-y-1 w-full', className)}>
        {children}
      </div>
    </NavigableListContext.Provider>
  );
}

export const NavigableList = Object.assign(NavigableListRoot, {
  Item: NavigableListItem,
});

export type {
  NavigableListRootProps,
  NavigableListItemProps,
  NavigableItem,
  RenderState,
};
