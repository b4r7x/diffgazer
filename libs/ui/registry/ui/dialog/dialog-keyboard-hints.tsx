"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface KeyboardHint {
  key: string;
  label: string;
}

export interface DialogKeyboardHintsProps extends HTMLAttributes<HTMLDivElement> {
  hints: KeyboardHint[];
}

export function DialogKeyboardHints({ hints, className, ...props }: DialogKeyboardHintsProps) {
  if (!hints.length) return null;

  return (
    <div
      className={cn("absolute -bottom-8 left-0 w-full flex justify-center gap-4 text-[10px] text-foreground/60", className)}
      {...props}
    >
      {hints.map((hint) => (
        <span key={hint.key}>
          <span className="text-foreground/50 font-bold">{hint.key}</span> {hint.label}
        </span>
      ))}
    </div>
  );
}
