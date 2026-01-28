"use client";

import type { RefObject } from "react";
import { Input, RadioGroup, RadioGroupItem } from "@/components/ui";
import { cn } from "@/lib/utils";

type InputMethod = "paste" | "env";

interface ApiKeyMethodSelectorProps {
  method: InputMethod;
  onMethodChange: (method: InputMethod) => void;
  keyValue: string;
  onKeyValueChange: (value: string) => void;
  envVarName: string;
  providerName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onBoundaryReached: (direction: "up" | "down") => void;
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
  onBoundaryReached,
  onKeySubmit,
}: ApiKeyMethodSelectorProps) {
  const handleMethodChange = (value: string) => {
    const newMethod = value as InputMethod;
    onMethodChange(newMethod);
    if (newMethod === "paste") {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <RadioGroup
      value={method}
      onValueChange={handleMethodChange}
      wrap={false}
      onBoundaryReached={onBoundaryReached}
      aria-label="API key input method"
    >
      <div className="space-y-2 mb-4">
        <RadioGroupItem value="paste" label="Paste Key Now" />
        {method === "paste" && (
          <div className="pl-9">
            <div className="flex items-center bg-tui-input-bg border border-tui-blue px-3 py-2 w-full">
              <span className="text-gray-500 mr-1 select-none">KEY:</span>
              <Input
                ref={inputRef}
                type="password"
                value={keyValue}
                onChange={(e) => onKeyValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onKeySubmit();
                  }
                }}
                aria-label={`${providerName} API Key`}
                className="flex-1 bg-transparent text-white tracking-widest border-0 focus:ring-0 h-auto p-0"
              />
            </div>
          </div>
        )}
      </div>
      <div
        className={cn(
          "space-y-2 transition-opacity",
          method === "env" ? "opacity-100" : "opacity-60 hover:opacity-100"
        )}
      >
        <RadioGroupItem value="env" label="Import from Env" />
        <div className="pl-9">
          <div className="flex items-center bg-tui-bg border border-tui-border px-3 py-2 w-full text-gray-500">
            <span className="mr-2 select-none text-gray-600">$</span>
            <span>{envVarName}</span>
          </div>
        </div>
      </div>
    </RadioGroup>
  );
}
