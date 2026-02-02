'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';
import { TabsContext } from './tabs-context';
import { TabsList } from './tabs-list';
import { TabsTrigger } from './tabs-trigger';
import { TabsContent } from './tabs-content';

export interface TabsProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}

function TabsRoot({
  value: controlledValue,
  onValueChange,
  defaultValue = '',
  children,
  className,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const triggersRef = React.useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const handleValueChange = onValueChange || setUncontrolledValue;

  const registerTrigger = React.useCallback((triggerValue: string, element: HTMLButtonElement | null) => {
    if (element) {
      triggersRef.current.set(triggerValue, element);
    } else {
      triggersRef.current.delete(triggerValue);
    }
  }, []);

  const getTriggers = React.useCallback(() => triggersRef.current, []);

  const contextValue = React.useMemo(
    () => ({ value, onValueChange: handleValueChange, registerTrigger, getTriggers }),
    [value, handleValueChange, registerTrigger, getTriggers]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});
