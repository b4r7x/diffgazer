"use client";

import {
  Children,
  isValidElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { isSelectableItemEligible, useSelectableCollection } from "@/lib/selectable-collection";
import { isStepInteractive, type StepStatus } from "@/lib/step-status";
import { StepperStep, type StepperStepProps } from "./stepper-step";
import { StepperTrigger, type StepperTriggerProps } from "./stepper-trigger";

export interface StepDescriptor {
  id: string;
  status: StepStatus;
  label: string | undefined;
  disabled: boolean;
}

export type StepRegistrationDescriptor = Omit<StepDescriptor, "disabled">;

function isStepSeedElementSkipped(props: StepperStepProps): boolean {
  return (
    props.hidden === true ||
    props.inert === true ||
    props["aria-hidden"] === true ||
    props["aria-hidden"] === "true"
  );
}

function collectStepSeed(children: ReactNode): StepDescriptor[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== StepperStep) return [];
    const props = child.props as StepperStepProps;
    const trigger = extractTriggerSeed(props.children);
    return [
      {
        id: props.stepId,
        status: props.status,
        label: trigger.label,
        disabled:
          !isStepInteractive(props.status) || trigger.disabled || isStepSeedElementSkipped(props),
      },
    ];
  });
}

function extractTriggerSeed(children: ReactNode): Pick<StepDescriptor, "label" | "disabled"> {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== StepperTrigger) continue;
    const props = child.props as StepperTriggerProps;
    const label =
      typeof props.children === "string" ? props.children.trim() || undefined : undefined;
    return { label, disabled: props.disabled === true };
  }
  return { label: undefined, disabled: false };
}

function isRegisteredStepDisabled(status: StepStatus, element: HTMLElement | null): boolean {
  if (!isStepInteractive(status)) return true;
  return element?.querySelector<HTMLButtonElement>("[data-step-id]")?.disabled === true;
}

/** Seed/live registration, eligibility sync, descriptors, and tab-target derivation. */
export function useStepCollection(
  children: ReactNode,
  listRef: RefObject<HTMLOListElement | null>,
) {
  const [stepMeta, setStepMeta] = useState<
    Record<string, { status: StepStatus; label: string | undefined }>
  >({});
  const {
    items: registeredSteps,
    registerItem: registerCollectionItem,
    unregisterItem: unregisterCollectionItem,
  } = useSelectableCollection(listRef);

  const registerStep = useCallback(
    (
      registrationId: string,
      descriptor: StepRegistrationDescriptor,
      element: HTMLElement | null,
    ) => {
      setStepMeta((current) => {
        const existing = current[registrationId];
        if (existing?.status === descriptor.status && existing.label === descriptor.label) {
          return current;
        }
        return {
          ...current,
          [registrationId]: { status: descriptor.status, label: descriptor.label },
        };
      });
      registerCollectionItem(
        registrationId,
        descriptor.id,
        isRegisteredStepDisabled(descriptor.status, element),
        element,
      );
    },
    [registerCollectionItem],
  );

  const unregisterStep = useCallback(
    (registrationId: string) => {
      setStepMeta((current) => {
        if (!(registrationId in current)) return current;
        const { [registrationId]: _removed, ...rest } = current;
        return rest;
      });
      unregisterCollectionItem(registrationId);
    },
    [unregisterCollectionItem],
  );

  const syncRegisteredDisabledState = useCallback(() => {
    for (const item of registeredSteps) {
      const meta = stepMeta[item.id];
      const disabled = isRegisteredStepDisabled(meta?.status ?? "pending", item.element);
      if (item.disabled === disabled) continue;
      registerCollectionItem(item.id, item.value, disabled, item.element);
    }
  }, [registeredSteps, stepMeta, registerCollectionItem]);

  useLayoutEffect(() => {
    syncRegisteredDisabledState();
  }, [syncRegisteredDisabledState]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const View = list?.ownerDocument.defaultView;
    if (!list || !View?.MutationObserver) return;

    const observer = new View.MutationObserver(syncRegisteredDisabledState);
    observer.observe(list, { attributeFilter: ["disabled"], attributes: true, subtree: true });

    return () => observer.disconnect();
  }, [listRef, syncRegisteredDisabledState]);

  const seed = useMemo(() => collectStepSeed(children), [children]);
  const steps = useMemo<StepDescriptor[]>(
    () =>
      registeredSteps.length
        ? registeredSteps.map((item) => {
            const meta = stepMeta[item.id];
            return {
              id: item.value,
              status: meta?.status ?? "pending",
              label: meta?.label,
              disabled: !isSelectableItemEligible(item),
            };
          })
        : seed,
    [registeredSteps, stepMeta, seed],
  );

  const tabTargetId = useMemo(() => {
    const interactive = steps.filter((step) => !step.disabled);
    const target = interactive.find((step) => step.status === "active") ?? interactive[0];
    return target?.id ?? null;
  }, [steps]);

  return { steps, tabTargetId, registerStep, unregisterStep };
}
