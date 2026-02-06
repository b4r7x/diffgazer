"use client";

import type { RefObject } from "react";
import { Input, Radio } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { FocusElement } from "./api-key-dialog";
import type { InputMethod } from "@/features/providers/constants";

interface ApiKeyMethodSelectorProps {
  method: InputMethod;
  onMethodChange: (method: InputMethod) => void;
  keyValue: string;
  onKeyValueChange: (value: string) => void;
  envVarName: string;
  providerName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  focused: FocusElement;
  onFocus: (element: FocusElement) => void;
  onKeySubmit: () => void;
}

export function ApiKeyMethodSelector({
  method,
  onMethodChange,
  keyValue,
  onKeyValueChange,
  envVarName,
  providerName,
  inputRef,
  focused,
  onFocus,
  onKeySubmit,
}: ApiKeyMethodSelectorProps) {
  return (
    <div aria-label="API key input method">
      <div className="space-y-2 mb-4">
        <Radio
          checked={method === "paste"}
          onCheckedChange={() => onMethodChange("paste")}
          label="Paste Key Now"
          focused={focused === "paste"}
        />
        <div className="pl-9">
          <div
            onClick={() => {
              onFocus("input");
              inputRef.current?.focus();
            }}
            className={cn(
              "flex items-center border px-3 py-2 w-full cursor-text",
              method === "paste"
                ? "bg-tui-input-bg border-tui-blue"
                : "bg-tui-bg border-tui-border opacity-40",
              focused === "input" && "ring-2 ring-tui-blue"
            )}
          >
            <span className="text-gray-500 mr-1 select-none">KEY:</span>
            <Input
              ref={inputRef}
              type="password"
              value={keyValue}
              onChange={(e) => onKeyValueChange(e.target.value)}
              onFocus={() => onFocus("input")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onKeySubmit();
                }
              }}
              disabled={method !== "paste"}
              aria-label={`${providerName} API Key`}
              className="flex-1 bg-transparent text-white tracking-widest border-0 focus:ring-0 h-auto p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>
      <div
        className={cn(
          "space-y-2 transition-opacity",
          method === "env" ? "opacity-100" : "opacity-60 hover:opacity-100"
        )}
      >
        <Radio
          checked={method === "env"}
          onCheckedChange={() => onMethodChange("env")}
          label="Import from Env"
          focused={focused === "env"}
        />
        <div className="pl-9">
          <div className="flex items-center bg-tui-bg border border-tui-border px-3 py-2 w-full text-gray-500">
            <span className="mr-2 select-none text-gray-600">$</span>
            <span>{envVarName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
