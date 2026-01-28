"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useKey } from "@/hooks/keyboard";
import {
  GEMINI_MODEL_INFO,
  OPENAI_MODEL_INFO,
  ANTHROPIC_MODEL_INFO,
  GLM_MODEL_INFO,
  type AIProvider,
  type ModelInfo,
} from "@repo/schemas";

interface ModelSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
  currentModel: string | undefined;
  onSelect: (modelId: string) => void;
}

function getModelsForProvider(provider: AIProvider): ModelInfo[] {
  switch (provider) {
    case "gemini":
      return Object.values(GEMINI_MODEL_INFO);
    case "openai":
      return Object.values(OPENAI_MODEL_INFO);
    case "anthropic":
      return Object.values(ANTHROPIC_MODEL_INFO);
    case "glm":
      return Object.values(GLM_MODEL_INFO);
    default:
      return [];
  }
}

export function ModelSelectDialog({
  open,
  onOpenChange,
  provider,
  currentModel,
  onSelect,
}: ModelSelectDialogProps) {
  const models = getModelsForProvider(provider);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected index when dialog opens or models change
  useEffect(() => {
    if (open) {
      const currentIndex = models.findIndex((m) => m.id === currentModel);
      setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [open, currentModel, models]);

  const handleConfirm = useCallback(() => {
    const model = models[selectedIndex];
    if (model) {
      onSelect(model.id);
      onOpenChange(false);
    }
  }, [models, selectedIndex, onSelect, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const navigateUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : models.length - 1));
  }, [models.length]);

  const navigateDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < models.length - 1 ? prev + 1 : 0));
  }, [models.length]);

  useKey("Enter", handleConfirm, { enabled: open && models.length > 0 });
  useKey("Escape", handleCancel, { enabled: open });
  useKey("ArrowUp", navigateUp, { enabled: open });
  useKey("ArrowDown", navigateDown, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-tui-border shadow-2xl">
        {/* Header */}
        <div className="border-b border-tui-border px-5 py-3 flex justify-between items-center bg-tui-selection/50">
          <span className="font-bold text-tui-blue tracking-wide">Select Model</span>
          <button
            type="button"
            onClick={handleCancel}
            className="text-gray-500 hover:text-tui-fg font-bold"
          >
            [x]
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
          {models.map((model, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  setSelectedIndex(index);
                }}
                onDoubleClick={handleConfirm}
                className={cn(
                  "flex items-start gap-3 w-full text-left px-3 py-2 rounded transition-colors",
                  isSelected
                    ? "bg-tui-selection/60 text-tui-fg"
                    : "text-gray-400 hover:bg-tui-selection/30 hover:text-tui-fg"
                )}
              >
                <span
                  className={cn(
                    "font-bold shrink-0 mt-0.5",
                    isSelected ? "text-tui-blue" : "text-gray-600"
                  )}
                >
                  {isSelected ? "[ \u25cf ]" : "[   ]"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{model.name}</span>
                    <Badge
                      variant={model.tier === "free" ? "success" : "neutral"}
                      size="xs"
                      className="uppercase border border-tui-border px-1.5 py-0.5"
                    >
                      {model.tier}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {model.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-tui-border px-5 py-3 flex justify-between items-center">
          <span className="text-xs text-gray-500">[Esc] Cancel</span>
          <button
            type="button"
            onClick={handleConfirm}
            className="bg-tui-blue text-black px-4 py-1.5 text-xs font-bold hover:brightness-110"
          >
            [Enter] Confirm
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
