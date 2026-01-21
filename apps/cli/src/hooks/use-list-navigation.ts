import { useState } from "react";
import { useInput, useApp } from "ink";

export interface UseListNavigationOptions<T extends { id: string }> {
  items: T[];
  onSelect: (item: T) => void;
  onDelete: (item: T) => void;
  onBack: () => void;
  disabled?: boolean;
  extraHandlers?: Record<string, () => void>;
}

export interface UseListNavigationResult {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  confirmDelete: string | null;
  isConfirmingDelete: boolean;
  cancelDelete: () => void;
}

export function useListNavigation<T extends { id: string }>(
  options: UseListNavigationOptions<T>
): UseListNavigationResult {
  const { items, onSelect, onDelete, onBack, disabled, extraHandlers } = options;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { exit } = useApp();

  useInput((input, key) => {
    if (disabled) return;

    // Delete confirmation mode
    if (confirmDelete) {
      if (input === "y") {
        const item = items.find((i) => i.id === confirmDelete);
        if (item) onDelete(item);
        setConfirmDelete(null);
      }
      if (input === "n" || key.escape) {
        setConfirmDelete(null);
      }
      return;
    }

    // Arrow navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
    if (key.downArrow && selectedIndex < items.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }

    // Select with Enter
    if (key.return && items[selectedIndex]) {
      onSelect(items[selectedIndex]);
    }

    // Delete with 'd'
    if (input === "d" && items[selectedIndex]) {
      setConfirmDelete(items[selectedIndex].id);
    }

    // Back with 'b' or Escape
    if (input === "b" || key.escape) {
      onBack();
    }

    // Quit with 'q'
    if (input === "q") {
      exit();
    }

    // Extra handlers
    const handler = extraHandlers?.[input];
    if (handler) {
      handler();
    }
  });

  return {
    selectedIndex,
    setSelectedIndex,
    confirmDelete,
    isConfirmingDelete: confirmDelete !== null,
    cancelDelete: () => setConfirmDelete(null),
  };
}
