import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { AIProvider, ModelInfo, OpenRouterModel } from "@repo/schemas/config";
import {
  GEMINI_MODEL_INFO,
  OPENAI_MODEL_INFO,
  ANTHROPIC_MODEL_INFO,
  GLM_MODEL_INFO,
} from "@repo/schemas/config";
import { Badge, SelectList, type SelectOption } from "../ui/index.js";
import { WizardFrame } from "./wizard-frame.js";
import { type WizardMode, getWizardFrameProps } from "../../types/index.js";
import { useWizardNavigation, getWizardFooterText } from "../../hooks/index.js";

interface ModelStepProps {
  mode: WizardMode;
  currentStep: number;
  totalSteps: number;
  provider: AIProvider;
  providerName: string;
  initialModel?: string;
  onSelect: (model: string) => void;
  onBack?: () => void;
  isActive?: boolean;
  fetchOpenRouterModels?: () => Promise<OpenRouterModel[]>;
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

function TierBadge({ tier, recommended }: { tier: "free" | "paid"; recommended?: boolean }): ReactElement {
  if (recommended) {
    return <Badge text="Recommended" variant="success" />;
  }
  if (tier === "free") {
    return <Badge text="Free Tier" variant="info" />;
  }
  return <Badge text="Paid" variant="default" />;
}

function OpenRouterModelStep({
  mode,
  currentStep,
  totalSteps,
  providerName,
  initialModel,
  onSelect,
  onBack,
  isActive = true,
  fetchOpenRouterModels,
}: Omit<ModelStepProps, "provider"> & { fetchOpenRouterModels?: () => Promise<OpenRouterModel[]> }): ReactElement {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    async function loadModels() {
      if (!fetchOpenRouterModels) {
        setError("Model fetcher not provided");
        setLoading(false);
        return;
      }

      try {
        const fetchedModels = await fetchOpenRouterModels();
        setModels(fetchedModels);
        if (initialModel) {
          const idx = fetchedModels.findIndex((m) => m.id === initialModel);
          if (idx >= 0) setSelectedIndex(idx);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load models");
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, [fetchOpenRouterModels, initialModel]);

  const filteredModels = searchQuery
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : models;

  const displayModels = filteredModels.slice(0, 15);

  const options: SelectOption<string>[] = displayModels.map((model) => ({
    id: model.id,
    label: model.name,
    description: `Context: ${(model.contextLength / 1000).toFixed(0)}K`,
    badge: model.isFree ? <Badge text="Free" variant="info" /> : <Badge text="Paid" variant="default" />,
  }));

  useWizardNavigation({
    onBack: isSearching ? undefined : onBack,
    isActive,
    onInput: (input, key) => {
      if (input === "/" && !isSearching) {
        setIsSearching(true);
        return;
      }

      if (key.escape && isSearching) {
        setIsSearching(false);
        setSearchQuery("");
      }
    },
  });

  useEffect(() => {
    if (searchQuery) setSelectedIndex(0);
  }, [searchQuery]);

  const footerText = isSearching
    ? "Type to search, Esc to clear, Enter to select"
    : getWizardFooterText({ mode, hasBack: !!onBack, prefix: "[/] Search, Arrow keys to select" });

  const frameProps = getWizardFrameProps(mode);

  if (loading) {
    return (
      <WizardFrame
        mode={mode}
        currentStep={currentStep}
        totalSteps={totalSteps}
        stepTitle="Select Model"
        footer="Loading models..."
        {...frameProps}
      >
        <Box>
          <Spinner type="dots" />
          <Text> Loading OpenRouter models...</Text>
        </Box>
      </WizardFrame>
    );
  }

  if (error) {
    return (
      <WizardFrame
        mode={mode}
        currentStep={currentStep}
        totalSteps={totalSteps}
        stepTitle="Select Model"
        footer={onBack ? "[b] Back" : ""}
        {...frameProps}
      >
        <Text color="red">Error: {error}</Text>
      </WizardFrame>
    );
  }

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="Select Model"
      footer={footerText}
      {...frameProps}
    >
      <Text dimColor>Choose a model for {providerName} (400+ models available):</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>Search: </Text>
        {isSearching ? (
          <TextInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Type to filter models..."
          />
        ) : (
          <Text>{searchQuery || "(press / to search)"}</Text>
        )}
      </Box>

      {filteredModels.length === 0 ? (
        <Text dimColor>No models match your search.</Text>
      ) : (
        <>
          <SelectList
            options={options}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onSubmit={(option) => onSelect(option.id)}
            isActive={isActive && !isSearching}
          />
          {filteredModels.length > 15 && (
            <Box marginTop={1}>
              <Text dimColor>
                Showing 15 of {filteredModels.length} models. Use search to filter.
              </Text>
            </Box>
          )}
        </>
      )}
    </WizardFrame>
  );
}

export function ModelStep({
  mode,
  currentStep,
  totalSteps,
  provider,
  providerName,
  initialModel,
  onSelect,
  onBack,
  isActive = true,
  fetchOpenRouterModels,
}: ModelStepProps): ReactElement {
  if (provider === "openrouter") {
    return (
      <OpenRouterModelStep
        mode={mode}
        currentStep={currentStep}
        totalSteps={totalSteps}
        providerName={providerName}
        initialModel={initialModel}
        onSelect={onSelect}
        onBack={onBack}
        isActive={isActive}
        fetchOpenRouterModels={fetchOpenRouterModels}
      />
    );
  }

  const models = getModelsForProvider(provider);

  const initialIndex = initialModel
    ? models.findIndex((m) => m.id === initialModel)
    : models.findIndex((m) => m.recommended) ?? 0;

  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialIndex));

  const options: SelectOption<string>[] = models.map((model) => ({
    id: model.id,
    label: model.name,
    description: model.description,
    badge: <TierBadge tier={model.tier} recommended={model.recommended} />,
  }));

  useWizardNavigation({ onBack, isActive });

  const footerText = getWizardFooterText({ mode, hasBack: !!onBack });

  return (
    <WizardFrame
      mode={mode}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepTitle="Select Model"
      footer={footerText}
      {...getWizardFrameProps(mode)}
    >
      <Text dimColor>Choose a model for {providerName}:</Text>

      <Box marginTop={1}>
        <SelectList
          options={options}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onSubmit={(option) => onSelect(option.id)}
          isActive={isActive}
        />
      </Box>
    </WizardFrame>
  );
}
