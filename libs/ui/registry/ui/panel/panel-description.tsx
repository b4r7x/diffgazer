"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { usePanelContext } from "./panel-context";

export interface PanelDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function PanelDescription({ className, ...props }: PanelDescriptionProps) {
  const { descriptionId } = usePanelContext();

  return (
    <p
      {...props}
      data-slot="panel-description"
      id={descriptionId}
      className={cn("m-0 text-xs leading-normal text-foreground/70", className)}
    />
  );
}
