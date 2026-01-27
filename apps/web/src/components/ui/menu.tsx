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

interface MenuItemData {
  id: string;
  disabled: boolean;
  index: number;
}

interface MenuContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: MenuItemData) => void;
  items: MenuItemData[];
}

interface MenuItemProps {
  id: string;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  hotkey?: number | string;
  children: ReactNode;
  className?: string;
}

interface MenuRootProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: { id: string; disabled: boolean; index: number }) => void;
  keyboardEnabled?: boolean;
  enableNumberJump?: boolean;
  className?: string;
  children: ReactNode;
}

interface MenuDividerProps {
  className?: string;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('Menu.Item must be used within Menu');
  }
  return context;
}

function MenuItem({
  id,
  disabled = false,
  variant = 'default',
  hotkey,
  children,
  className,
}: MenuItemProps) {
  const { selectedIndex, onSelect, onActivate, items } = useMenuContext();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isSelected = itemData.index === selectedIndex;
  const isDanger = variant === 'danger';

  const baseClasses = 'px-4 py-3 flex items-center cursor-pointer font-mono w-full';
  const disabledClasses = disabled && 'opacity-50 cursor-not-allowed';

  const handleClick = () => {
    if (!disabled) {
      onSelect(itemData.index);
      onActivate?.(itemData);
    }
  };

  if (isSelected) {
    const selectedBg = isDanger ? 'bg-tui-red' : 'bg-tui-blue';
    return (
      <div
        role="option"
        aria-selected={true}
        aria-disabled={disabled}
        onClick={handleClick}
        className={cn(baseClasses, selectedBg, 'text-black font-bold', disabledClasses, className)}
      >
        <span className="mr-3 shrink-0">▌</span>
        {hotkey !== undefined && <span className="mr-4 shrink-0">[{hotkey}]</span>}
        <span>{children}</span>
      </div>
    );
  }

  const textColor = isDanger ? 'text-tui-red' : 'text-tui-fg';
  const indicatorColor = isDanger ? 'text-tui-red' : 'text-tui-blue';

  return (
    <div
      role="option"
      aria-selected={false}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        baseClasses,
        textColor,
        'hover:bg-tui-selection group transition-colors duration-75',
        disabledClasses,
        className
      )}
    >
      <span className={cn('mr-3 shrink-0 opacity-0 group-hover:opacity-100', indicatorColor)}>
        ▌
      </span>
      {hotkey !== undefined && (
        <span className={cn('mr-4 shrink-0 group-hover:text-tui-fg', indicatorColor)}>
          [{hotkey}]
        </span>
      )}
      <span className={cn('tracking-wide', !isDanger && 'group-hover:text-white')}>{children}</span>
    </div>
  );
}

function MenuDivider({ className }: MenuDividerProps) {
  return <div className={cn('my-1 border-t border-tui-border mx-4 opacity-50', className)} />;
}

function MenuRoot({
  selectedIndex,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  enableNumberJump = false,
  className,
  children,
}: MenuRootProps) {
  const items: MenuItemData[] = [];
  let itemIndex = 0;

  function extractItems(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        extractItems(child.props.children);
      } else if (child.type === MenuItem) {
        const props = child.props as MenuItemProps;
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

  const contextValue: MenuContextValue = {
    selectedIndex,
    onSelect,
    onActivate,
    items,
  };

  return (
    <MenuContext.Provider value={contextValue}>
      <div role="listbox" className={cn('w-full', className)}>
        {children}
      </div>
    </MenuContext.Provider>
  );
}

export const Menu = Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
});

export type { MenuRootProps, MenuItemProps, MenuDividerProps, MenuItemData };
