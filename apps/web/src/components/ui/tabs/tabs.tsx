import * as React from 'react';
import { cn } from '@/utils/cn';
import { TabsContext } from './tabs-context';

export interface TabsProps<T extends string = string> {
  value?: T;
  onValueChange?: (value: T) => void;
  defaultValue?: T;
  children: React.ReactNode;
  className?: string;
}

function TabsRoot<T extends string = string>({
  value: controlledValue,
  onValueChange,
  defaultValue = '' as T,
  children,
  className,
}: TabsProps<T>) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const triggersRef = React.useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const handleValueChange = React.useCallback(
    (v: string) => {
      if (onValueChange) onValueChange(v as T);
      else setUncontrolledValue(v as T);
    },
    [onValueChange]
  );

  const registerTrigger = React.useCallback((triggerValue: string, element: HTMLButtonElement | null) => {
    if (element) {
      triggersRef.current.set(triggerValue, element);
    } else {
      triggersRef.current.delete(triggerValue);
    }
  }, []);

  const getTriggers = React.useCallback(() => triggersRef.current, []);

  const contextValue = React.useMemo(
    () => ({ value: value as string, onValueChange: handleValueChange, registerTrigger, getTriggers }),
    [value, handleValueChange, registerTrigger, getTriggers]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export { TabsRoot as Tabs };
