import { useState, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey, useFocusZone } from "@stargazer/keyboard";
import { PROVIDER_FILTER_VALUES, type ProviderFilter } from "@/features/providers/constants";
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
  const [filterIndex, setFilterIndex] = useState(0);
  const [buttonIndex, setButtonIndex] = useState(0);

  const { zone: internalZone, setZone, inZone } = useFocusZone({
    initial: "list" as FocusZone,
    zones: ["input", "filters", "list", "buttons"] as const,
    scope: "providers",
    enabled: !dialogOpen,
  });

  const effectiveFocusZone = (!selectedProvider && internalZone === "buttons") ? "list" : internalZone;

  const canRemoveKey = selectedProvider?.hasApiKey ?? false;
  const needsModel = selectedProvider !== null && !selectedProvider.model;

  const getNextButtonIndex = (current: number, direction: 1 | -1) => {
    const enabled = [!needsModel, true, canRemoveKey, true];
    let next = current + direction;
    while (next >= 0 && next < 4) {
      if (enabled[next]) return next;
      next += direction;
    }
    return current;
  };

  const focusBoundaryProvider = (target: "first" | "last") => {
    const targetId =
      target === "last"
        ? filteredProviders[filteredProviders.length - 1]?.id
        : filteredProviders[0]?.id;
    if (targetId) setSelectedId(targetId);
  };

  const handleButtonAction = (index: number) => {
    if (!selectedProvider) return;
    switch (index) {
      case 0: if (!needsModel) void onSelectProvider(selectedProvider.id, selectedProvider.name, selectedProvider.model); break;
      case 1: onSetApiKey(); break;
      case 2: if (selectedProvider.hasApiKey) void onRemoveKey(selectedProvider.id); break;
      case 3: onSelectModel(); break;
    }
  };

  const inInput = effectiveFocusZone === "input";
  const inFilters = effectiveFocusZone === "filters";
  const inButtons = effectiveFocusZone === "buttons";

  // Input zone — useFocusZone can't handle transitions from input (no allowInInput)
  // so we manually change zone AND blur
  useKey("ArrowDown", () => {
    setZone("filters");
    inputRef.current?.blur();
  }, { enabled: !dialogOpen && inInput, allowInInput: true });
  useKey("Escape", () => {
    setZone("filters");
    inputRef.current?.blur();
  }, { enabled: !dialogOpen && inInput, allowInInput: true });

  // Filters zone — side-effects for transitions + horizontal nav + actions
  useKey("ArrowUp", () => {
    setZone("input");
    inputRef.current?.focus();
  }, { enabled: !dialogOpen && inFilters });
  useKey("ArrowDown", () => {
    if (filteredProviders.length > 0) {
      setZone("list");
      focusBoundaryProvider("first");
    }
  }, { enabled: !dialogOpen && inFilters });
  useKey("ArrowLeft", () => setFilterIndex((i) => Math.max(0, i - 1)),
    { enabled: !dialogOpen && inFilters });
  useKey("ArrowRight", () => setFilterIndex((i) => Math.min(PROVIDER_FILTER_VALUES.length - 1, i + 1)),
    { enabled: !dialogOpen && inFilters });
  useKey("Enter", () => setFilter(PROVIDER_FILTER_VALUES[filterIndex]),
    { enabled: !dialogOpen && inFilters });
  useKey(" ", () => setFilter(PROVIDER_FILTER_VALUES[filterIndex]),
    { enabled: !dialogOpen && inFilters });

  // List zone — side-effect for transition to buttons
  useKey("ArrowRight", () => {
    setZone("buttons");
    setButtonIndex(getNextButtonIndex(-1, 1));
  }, { enabled: !dialogOpen && inZone("list") && !!selectedProvider });

  // Buttons zone — horizontal/vertical nav + actions
  useKey("ArrowLeft", () => {
    const next = getNextButtonIndex(buttonIndex, -1);
    if (next === buttonIndex) {
      setZone("list");
      focusBoundaryProvider("last");
    } else {
      setButtonIndex(next);
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
    setZone("input");
    inputRef.current?.focus();
  }, { enabled: !dialogOpen && !inInput });

  const handleListBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      setZone("filters");
      setFilterIndex(PROVIDER_FILTER_VALUES.indexOf(filter));
    }
  };

  return { focusZone: effectiveFocusZone, filterIndex, buttonIndex, handleListBoundary };
}
