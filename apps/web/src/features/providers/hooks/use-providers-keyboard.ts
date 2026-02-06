import { useState, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey } from "@/hooks/keyboard";
import { FILTER_VALUES } from "@/features/providers/components/provider-list";
import type { ProviderFilter } from "@/features/providers/constants";
import type { AIProvider } from "@stargazer/schemas/config";

type FocusZone = "input" | "filters" | "list" | "buttons";

interface ProvidersKeyboardOptions {
  selectedId: string | null;
  selectedProvider: { id: AIProvider; hasApiKey: boolean; model?: string; name: string } | null;
  filteredProviders: Array<{ id: string }>;
  filter: ProviderFilter;
  setFilter: (filter: ProviderFilter) => void;
  setSelectedId: (id: string) => void;
  dialogOpen: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSetApiKey: () => void;
  onSelectModel: () => void;
  onRemoveKey: (id: AIProvider) => Promise<void>;
  onSelectProvider: (id: AIProvider, name: string, model: string | undefined) => Promise<void>;
}

interface ProvidersKeyboardReturn {
  focusZone: FocusZone;
  filterIndex: number;
  buttonIndex: number;
  handleListBoundary: (direction: "up" | "down") => void;
}

export function useProvidersKeyboard({
  selectedProvider,
  filteredProviders,
  filter,
  setFilter,
  setSelectedId,
  dialogOpen,
  inputRef,
  onSetApiKey,
  onSelectModel,
  onRemoveKey,
  onSelectProvider,
}: ProvidersKeyboardOptions): ProvidersKeyboardReturn {
  const navigate = useNavigate();
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [filterIndex, setFilterIndex] = useState(0);
  const [buttonIndex, setButtonIndex] = useState(0);

  const effectiveFocusZone = (!selectedProvider && focusZone === "buttons") ? "list" : focusZone;

  const canRemoveKey = selectedProvider?.hasApiKey ?? false;
  const needsOpenRouterModel = selectedProvider?.id === "openrouter" && !selectedProvider?.model;

  const getNextButtonIndex = (current: number, direction: 1 | -1) => {
    const enabled = [!needsOpenRouterModel, true, canRemoveKey, true];
    let next = current + direction;
    while (next >= 0 && next < 4) {
      if (enabled[next]) return next;
      next += direction;
    }
    return current;
  };

  const handleButtonAction = (index: number) => {
    if (!selectedProvider) return;
    switch (index) {
      case 0: if (!needsOpenRouterModel) void onSelectProvider(selectedProvider.id, selectedProvider.name, selectedProvider.model); break;
      case 1: onSetApiKey(); break;
      case 2: if (selectedProvider.hasApiKey) void onRemoveKey(selectedProvider.id); break;
      case 3: onSelectModel(); break;
    }
  };

  const inInput = effectiveFocusZone === "input";
  const inFilters = effectiveFocusZone === "filters";
  const inList = effectiveFocusZone === "list";
  const inButtons = effectiveFocusZone === "buttons";

  // Input zone
  useKey("ArrowDown", () => {
    setFocusZone("filters");
    inputRef.current?.blur();
  }, { enabled: !dialogOpen && inInput, allowInInput: true });
  useKey("Escape", () => {
    setFocusZone("filters");
    inputRef.current?.blur();
  }, { enabled: !dialogOpen && inInput, allowInInput: true });

  // Filters zone
  useKey("ArrowUp", () => {
    setFocusZone("input");
    inputRef.current?.focus();
  }, { enabled: !dialogOpen && inFilters });
  useKey("ArrowDown", () => {
    setFocusZone("list");
    if (filteredProviders.length > 0) {
      setSelectedId(filteredProviders[0].id);
    }
  }, { enabled: !dialogOpen && inFilters });
  useKey("ArrowLeft", () => setFilterIndex((i) => Math.max(0, i - 1)),
    { enabled: !dialogOpen && inFilters });
  useKey("ArrowRight", () => setFilterIndex((i) => Math.min(FILTER_VALUES.length - 1, i + 1)),
    { enabled: !dialogOpen && inFilters });
  useKey("Enter", () => setFilter(FILTER_VALUES[filterIndex]),
    { enabled: !dialogOpen && inFilters });
  useKey(" ", () => setFilter(FILTER_VALUES[filterIndex]),
    { enabled: !dialogOpen && inFilters });

  // List zone
  useKey("ArrowRight", () => { setFocusZone("buttons"); setButtonIndex(getNextButtonIndex(-1, 1)); },
    { enabled: !dialogOpen && inList && !!selectedProvider });

  // Buttons zone
  useKey("ArrowLeft", () => {
    if (buttonIndex === 0) {
      setFocusZone("list");
    } else {
      setButtonIndex((i) => getNextButtonIndex(i, -1));
    }
  }, { enabled: !dialogOpen && inButtons });
  useKey("ArrowRight", () => setButtonIndex((i) => getNextButtonIndex(i, 1)),
    { enabled: !dialogOpen && inButtons });
  useKey("ArrowUp", () => setButtonIndex((i) => getNextButtonIndex(i, -1)),
    { enabled: !dialogOpen && inButtons });
  useKey("ArrowDown", () => setButtonIndex((i) => getNextButtonIndex(i, 1)),
    { enabled: !dialogOpen && inButtons });
  useKey("Enter", () => handleButtonAction(buttonIndex),
    { enabled: !dialogOpen && inButtons });
  useKey(" ", () => handleButtonAction(buttonIndex),
    { enabled: !dialogOpen && inButtons });

  // Global shortcuts
  useKey("Escape", () => navigate({ to: "/settings" }), { enabled: !dialogOpen && !inInput });
  useKey("/", () => {
    setFocusZone("input");
    inputRef.current?.focus();
  }, { enabled: !dialogOpen && !inInput });

  const handleListBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setFocusZone("filters");
      setFilterIndex(FILTER_VALUES.indexOf(filter));
    }
  };

  return { focusZone: effectiveFocusZone, filterIndex, buttonIndex, handleListBoundary };
}
