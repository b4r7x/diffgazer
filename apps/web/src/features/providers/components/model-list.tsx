import { forwardRef } from "react";
import type { ModelInfo } from "@repo/schemas";
import { ModelListItem } from "./model-list-item";

interface ModelListProps {
  models: ModelInfo[];
  selectedIndex: number;
  isFocused: boolean;
  onSelect: (index: number) => void;
  onConfirm: () => void;
}

export const ModelList = forwardRef<HTMLDivElement, ModelListProps>(
  function ModelList(
    { models, selectedIndex, isFocused, onSelect, onConfirm },
    ref
  ) {
    if (models.length === 0) {
      return (
        <div
          ref={ref}
          role="listbox"
          aria-label="Available models"
          className="px-4 py-2 max-h-60 overflow-y-auto scrollbar-thin"
        >
          <div className="text-center text-gray-500 py-8 text-sm">
            No models match your search
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role="listbox"
        aria-label="Available models"
        className="px-4 py-2 space-y-1 max-h-60 overflow-y-auto scrollbar-thin"
      >
        {models.map((model, index) => (
          <ModelListItem
            key={model.id}
            model={model}
            isSelected={index === selectedIndex}
            isFocused={isFocused}
            onClick={() => onSelect(index)}
            onDoubleClick={onConfirm}
          />
        ))}
      </div>
    );
  }
);
