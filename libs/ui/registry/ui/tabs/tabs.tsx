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
}

interface TabSeed {
  enabledValues: string[];
  panelValues: string[];
  triggerValues: string[];
}

// First-render/SSR seed for directly-composed parts: registration effects have
// not run yet, so resolve a sensible selected tab from the static child tree.
// Once items mount, the context registrations below are authoritative and also
// cover parts rendered through consumer wrapper components.
function collectTabSeed(children: ReactNode): TabSeed {
  const seed: TabSeed = { enabledValues: [], panelValues: [], triggerValues: [] };

  Children.forEach(children, (child) => {
    if (!isValidElement<TabTriggerElementProps>(child)) return;
    if (child.type === TabsRoot) return;

    if (child.type === TabsTrigger && typeof child.props.value === "string") {
      seed.triggerValues.push(child.props.value);
      if (!child.props.disabled) seed.enabledValues.push(child.props.value);
      return;
    }

    if (child.type === TabsContent && typeof child.props.value === "string") {
      seed.panelValues.push(child.props.value);
    }

    const nested = collectTabSeed(child.props.children);
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
  const enabledValues = useMemo(
    () =>
      registeredTriggers.length
        ? registeredTriggers.filter((item) => !item.disabled).map((item) => item.value)
        : seed.enabledValues,
    [registeredTriggers, seed.enabledValues],
  );
  const panelValues = useMemo(
    () => (registeredPanels.length ? registeredPanels.map((item) => item.value) : seed.panelValues),
    [registeredPanels, seed.panelValues],
  );
  const [value, setValue] = useControllableState<string>({
    value: "value" in props ? (controlledValue ?? "") : undefined,
    controlled: "value" in props,
    defaultValue: defaultValue ?? "",
    // TValue is a string subtype; downstream context uses string for runtime DOM matching.
    onChange: onChange as ((value: string) => void) | undefined,
  });
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const firstEnabledTab = enabledValues[0] ?? "";
  const resolvedValue = enabledValues.includes(value) ? value : firstEnabledTab;

  // A non-empty value that no registered trigger owns silently falls back to the
  // first enabled tab; warn in development so the gap surfaces.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || value === "") return;
    // Defer to the next frame so a trigger registered by a wrapper component (its
    // registration runs in a layout effect, after this render computed the seed)
    // joins triggerValues before we warn. A change to triggerValues cancels this
    // frame via cleanup and reschedules with the registered set, so the surviving
    // frame always sees the settled values — avoiding a false first-render warning.
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
