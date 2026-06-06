"use client";

import {
  Children,
  type HTMLAttributes,
  isValidElement,
  type ReactNode,
  type Ref,
  useId,
  useMemo,
  useState,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import type { SegmentedSize, SegmentedVariant } from "@/lib/segmented-variants";
import { cn } from "@/lib/utils";
import { TabsContent } from "./tabs-content";
import { TabsContext } from "./tabs-context";
import { TabsTrigger } from "./tabs-trigger";

export interface TabsProps<TValue extends string = string>
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: TValue;
  onChange?: (value: TValue) => void;
  defaultValue?: TValue;
  orientation?: "horizontal" | "vertical";
  variant?: SegmentedVariant;
  size?: SegmentedSize;
  activationMode?: "automatic" | "manual";
  ref?: Ref<HTMLDivElement>;
}

interface TabTriggerElementProps {
  value?: string;
  disabled?: boolean;
  children?: ReactNode;
}

interface TabMetadata {
  enabledValues: string[];
  panelValues: string[];
  triggerValues: string[];
}

function collectTabMetadata(children: ReactNode): TabMetadata {
  const metadata: TabMetadata = {
    enabledValues: [],
    panelValues: [],
    triggerValues: [],
  };

  Children.forEach(children, (child) => {
    if (!isValidElement<TabTriggerElementProps>(child)) return;
    if (child.type === TabsRoot) return;

    if (child.type === TabsTrigger && typeof child.props.value === "string") {
      metadata.triggerValues.push(child.props.value);
      if (!child.props.disabled) metadata.enabledValues.push(child.props.value);
      return;
    }

    if (child.type === TabsContent && typeof child.props.value === "string") {
      metadata.panelValues.push(child.props.value);
    }

    const childMetadata = collectTabMetadata(child.props.children);
    metadata.enabledValues.push(...childMetadata.enabledValues);
    metadata.panelValues.push(...childMetadata.panelValues);
    metadata.triggerValues.push(...childMetadata.triggerValues);
  });

  return metadata;
}

function TabsRoot<TValue extends string = string>({
  value: controlledValue,
  onChange,
  defaultValue,
  orientation = "horizontal",
  variant = "underline",
  size = "sm",
  activationMode = "automatic",
  children,
  className,
  ref,
  ...rest
}: TabsProps<TValue>) {
  const tabsId = useId();
  const { enabledValues, panelValues, triggerValues } = useMemo(() => collectTabMetadata(children), [children]);
  const [value, setValue] = useControllableState<string>({
    value: controlledValue,
    defaultValue: defaultValue ?? "",
    // TValue is a string subtype; downstream context uses string for runtime DOM matching.
    onChange: onChange as ((value: string) => void) | undefined,
  });
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const firstEnabledTab = enabledValues[0] ?? "";
  const resolvedValue = enabledValues.includes(value) ? value : firstEnabledTab;
  const resolvedFocusedValue = focusedValue !== null && enabledValues.includes(focusedValue)
    ? focusedValue
    : resolvedValue;

  const contextValue = useMemo(
    () => ({
      tabsId,
      value: resolvedValue,
      tabbableValue: activationMode === "manual" ? resolvedFocusedValue : resolvedValue,
      onChange: setValue,
      onFocusChange: setFocusedValue,
      panelValues,
      triggerValues,
      orientation,
      variant,
      size,
      activationMode,
    }),
    [tabsId, resolvedValue, resolvedFocusedValue, activationMode, setValue, panelValues, triggerValues, orientation, variant, size],
  );

  return (
    <TabsContext value={contextValue}>
      <div
        ref={ref}
        className={cn("flex flex-col", className)}
        data-orientation={orientation}
        {...rest}
      >
        {children}
      </div>
    </TabsContext>
  );
}

export { TabsRoot as Tabs };
