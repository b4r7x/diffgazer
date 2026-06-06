"use client";

import {
  Children,
  type ComponentPropsWithRef,
  type ElementType,
  isValidElement,
  type ReactNode,
  useId,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { PanelContext, type PanelContextValue } from "./panel-context";
import { PanelDescription } from "./panel-description";
import { PanelTitle } from "./panel-title";

export type PanelElement = "div" | "article" | "section" | "aside";

export type PanelFrame = "hairline" | "rail" | "viewfinder" | "surface";
export type PanelTone = "info" | "success" | "warning" | "error" | "accent";
export type PanelDensity = "default" | "compact";

interface PanelOwnProps {
  frame?: PanelFrame;
  tone?: PanelTone;
  density?: PanelDensity;
}

export type PanelProps<T extends PanelElement = "div"> = Omit<
  ComponentPropsWithRef<T>,
  keyof PanelOwnProps | "as"
> &
  PanelOwnProps & {
    as?: T;
  };

export function Panel<T extends PanelElement = "div">(props: PanelProps<T>) {
  const {
    as,
    ref,
    className,
    frame,
    tone,
    density,
    children,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rest
  } = props as PanelProps<PanelElement>;

  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  const contextValue = useMemo<PanelContextValue>(
    () => ({ titleId, descriptionId }),
    [titleId, descriptionId],
  );

  const hasRenderableTitle = containsPanelTitleElement(children);
  const hasRenderableDescription = containsPanelDescriptionElement(children);
  const hasAriaName = isNonEmptyString(ariaLabel) || isNonEmptyString(ariaLabelledBy);
  const isNamedRegion = hasRenderableTitle || hasAriaName;

  const resolvedFrame = frame ?? "hairline";
  const resolvedDensity = density ?? "default";
  const Tag = (as ?? (isNamedRegion ? "section" : "div")) as ElementType;

  const accessibleName = resolvePanelAccessibleName({
    ariaLabel,
    ariaLabelledBy,
    titleId,
    hasRenderableTitle,
  });
  const resolvedAriaDescribedBy = hasRenderableDescription ? descriptionId : undefined;

  return (
    <PanelContext value={contextValue}>
      <Tag
        {...rest}
        ref={ref}
        data-slot="panel"
        data-frame={resolvedFrame}
        data-tone={tone ?? undefined}
        data-density={resolvedDensity}
        aria-label={accessibleName["aria-label"]}
        aria-labelledby={accessibleName["aria-labelledby"]}
        aria-describedby={resolvedAriaDescribedBy}
        className={cn(className)}
      >
        {resolvedFrame === "viewfinder" ? (
          <span aria-hidden="true" data-slot="panel-corners">
            <span className="vf-tl" />
            <span className="vf-tr" />
            <span className="vf-bl" />
            <span className="vf-br" />
          </span>
        ) : null}
        {children}
      </Tag>
    </PanelContext>
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolvePanelAccessibleName({
  ariaLabel,
  ariaLabelledBy,
  titleId,
  hasRenderableTitle,
}: {
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
  titleId: string;
  hasRenderableTitle: boolean;
}): { "aria-label": string | undefined; "aria-labelledby": string | undefined } {
  if (isNonEmptyString(ariaLabelledBy)) {
    return { "aria-label": undefined, "aria-labelledby": ariaLabelledBy };
  }
  if (isNonEmptyString(ariaLabel)) {
    return { "aria-label": ariaLabel, "aria-labelledby": undefined };
  }
  if (hasRenderableTitle) {
    return { "aria-label": undefined, "aria-labelledby": titleId };
  }
  return { "aria-label": undefined, "aria-labelledby": undefined };
}

function containsPanelTitleElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === PanelTitle) return true;
    return containsPanelTitleElement(child.props.children);
  });
}

function containsPanelDescriptionElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === PanelDescription) return true;
    return containsPanelDescriptionElement(child.props.children);
  });
}
