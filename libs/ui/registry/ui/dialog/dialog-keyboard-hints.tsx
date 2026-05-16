"use client";

import type { HTMLAttributes } from "react";
import { Kbd } from "../kbd/kbd";
import { cn } from "@/lib/utils";

export interface KeyboardHint {
  key: string;
  label: string;
}

export interface DialogKeyboardHintsProps extends HTMLAttributes<HTMLDivElement> {
  hints: KeyboardHint[];
  size?: "sm" | "md";
}

export function DialogKeyboardHints({ hints, size = "md", className, ...props }: DialogKeyboardHintsProps) {
  if (!hints.length) return null;

  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}
      {...props}
    >
      {hints.map((hint) => (
        <span key={`${hint.key}-${hint.label}`} className="inline-flex items-center gap-1">
          <Kbd size={size} aria-hidden="true">{hint.key}</Kbd>
          <span>{hint.label}</span>
        </span>
      ))}
    </div>
  );
}
