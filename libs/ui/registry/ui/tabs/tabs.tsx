"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import type { SegmentedSize, SegmentedVariant } from "@/lib/segmented-variants";
import { useSelectableCollection } from "@/lib/selectable-collection";
import { cn } from "@/lib/utils";
import { warnUnregisteredValue } from "@/lib/warn-unregistered-value";
import { TabsContent } from "./tabs-content";
import { TabsContext } from "./tabs-context";
import { TabsTrigger } from "./tabs-trigger";

/** Props for tabs. */
export interface TabsProps<TValue extends string = string>
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled active tab value. Pair with onChange. */
  value?: TValue;
  /** Fired when the active tab changes. */
  onChange?: (value: TValue) => void;
  /** Initial active tab value for uncontrolled mode. Defaults to the first enabled Trigger. */
  defaultValue?: TValue;
  /** Tab list axis. Switches arrow-key navigation direction and aria-orientation. */
  orientation?: "horizontal" | "vertical";
  /** Visual style applied to triggers and the list. */
  variant?: SegmentedVariant;
  /** Size variant. */
  size?: SegmentedSize;
  /** Automatic activates on focus; manual requires Enter or Space. */
  activationMode?: "automatic" | "manual";
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Props for tab trigger element. */
interface TabTriggerElementProps {
  /** Controlled active tab value. Pair with onChange. */
  value?: string;
  /** Disables interaction. */
  disabled?: boolean;
  /** Tabs.List and Tabs.Content subparts. */
  children?: ReactNode;
  /** Native visibility props the seed mirrors so hidden triggers are not seeded as enabled. */
  hidden?: boolean;
  inert?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
}

interface TabSeed {
  enabledValues: string[];
  panelValues: string[];
  triggerValues: string[];
}

// SSR-seed mirror of the shared isSelectableElementSkipped DOM predicate; runs
// before any element mounts.
function isTabSeedElementSkipped(props: TabTriggerElementProps): boolean {
  return (
    props.hidden === true ||
    props.inert === true ||
    props["aria-hidden"] === true ||
    props["aria-hidden"] === "true"
  );
}

// SSR/first-render seed before registration effects run: resolve a selected tab
// from the static child tree. A skipped ancestor carries down so
// hidden/inert/aria-hidden wrappers exclude their triggers.
function collectTabSeed(children: ReactNode, skippedAncestor = false): TabSeed {
  const seed: TabSeed = { enabledValues: [], panelValues: [], triggerValues: [] };

  Children.forEach(children, (child) => {
    if (!isValidElement<TabTriggerElementProps>(child)) return;
    if (child.type === TabsRoot) return;

    const skipped = skippedAncestor || isTabSeedElementSkipped(child.props);

    if (child.type === TabsTrigger && typeof child.props.value === "string") {
      seed.triggerValues.push(child.props.value);
      if (!child.props.disabled && !skipped) seed.enabledValues.push(child.props.value);
      return;
    }

    if (child.type === TabsContent && typeof child.props.value === "string") {
      seed.panelValues.push(child.props.value);
    }

    const nested = collectTabSeed(child.props.children, skipped);
    seed.enabledValues.push(...nested.enabledValues);
    seed.panelValues.push(...nested.panelValues);
    seed.triggerValues.push(...nested.triggerValues);
  });

  return seed;
}

/** Terminal-styled tabbed interface with horizontal and vertical orientation support. */
function TabsRoot<TValue extends string = string>(props: TabsProps<TValue>) {
  const {
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
  } = props;
  const tabsId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const {
    items: registeredTriggers,
    eligibleItems: eligibleTriggers,
    registerItem: registerTrigger,
    unregisterItem: unregisterTrigger,
  } = useSelectableCollection(rootRef);
  const {
    items: registeredPanels,
    registerItem: registerPanel,
    unregisterItem: unregisterPanel,
  } = useSelectableCollection(rootRef);
  const seed = useMemo(() => collectTabSeed(children), [children]);
  const triggerValues = useMemo(
    () =>
      registeredTriggers.length ? registeredTriggers.map((item) => item.value) : seed.triggerValues,
    [registeredTriggers, seed.triggerValues],
  );
  const enabledValues = useMemo(() => {
    if (!registeredTriggers.length) return seed.enabledValues;
    return eligibleTriggers.map((item) => item.value);
  }, [eligibleTriggers, registeredTriggers.length, seed.enabledValues]);
  const panelValues = useMemo(
    () => (registeredPanels.length ? registeredPanels.map((item) => item.value) : seed.panelValues),
    [registeredPanels, seed.panelValues],
  );
  const [value, setValue] = useControllableState<string>({
    value: "value" in props ? (controlledValue ?? "") : undefined,
    controlled: "value" in props,
    defaultValue: defaultValue ?? "",
    // TValue is a string subtype; downstream context matches on string at runtime.
    onChange: onChange as ((value: string) => void) | undefined,
  });
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const firstEnabledTab = enabledValues[0] ?? "";
  const resolvedValue = enabledValues.includes(value) ? value : firstEnabledTab;

  // Warn in dev when a non-empty value owns no registered trigger (it silently
  // falls back to the first enabled tab).
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || value === "") return;
    // Defer a frame so wrapper-rendered triggers (registered in a layout effect)
    // join triggerValues before warning; a triggerValues change reschedules, so the
    // surviving frame sees settled values and avoids a false first-render warning.
    const view = rootRef.current?.ownerDocument.defaultView ?? globalThis;
    const frame = view.requestAnimationFrame(() => {
      warnUnregisteredValue("Tabs", value, triggerValues);
    });
    return () => view.cancelAnimationFrame(frame);
  }, [value, triggerValues]);

  const resolvedFocusedValue =
    focusedValue !== null && enabledValues.includes(focusedValue) ? focusedValue : resolvedValue;

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
      registerTrigger,
      unregisterTrigger,
      registerPanel,
      unregisterPanel,
    }),
    [
      tabsId,
      resolvedValue,
      resolvedFocusedValue,
      activationMode,
      setValue,
      panelValues,
      triggerValues,
      orientation,
      variant,
      size,
      registerTrigger,
      unregisterTrigger,
      registerPanel,
      unregisterPanel,
    ],
  );

  return (
    <TabsContext value={contextValue}>
      <div
        ref={composedRef}
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
