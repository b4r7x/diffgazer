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
import { Badge, SelectList, type SelectOption } from "./ui/index.js";
import { Panel, PanelHeader, PanelContent } from "./ui/panel.js";

interface ModelPickerProps {
  provider: AIProvider;
  providerName: string;
  onSelect: (model: string) => void;
  onCancel: () => void;
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

function OpenRouterModelPicker({
  providerName,
  onSelect,
  onCancel,
  isActive = true,
  fetchOpenRouterModels,
}: Omit<ModelPickerProps, "provider">): ReactElement {
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load models");
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, [fetchOpenRouterModels]);

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

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (input === "/" && !isSearching) {
        setIsSearching(true);
        return;
      }

      if (key.escape) {
        if (isSearching) {
          setIsSearching(false);
          setSearchQuery("");
        } else {
          onCancel();
        }
        return;
      }
    },
    { isActive }
  );

  useEffect(() => {
    if (searchQuery) setSelectedIndex(0);
  }, [searchQuery]);

  if (loading) {
    return (
      <Panel>
        <PanelHeader>SELECT MODEL</PanelHeader>
        <PanelContent>
          <Box>
            <Spinner type="dots" />
            <Text> Loading OpenRouter models...</Text>
          </Box>
        </PanelContent>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <PanelHeader>SELECT MODEL</PanelHeader>
        <PanelContent>
          <Text color="red">Error: {error}</Text>
          <Box marginTop={1}>
            <Text dimColor>[Esc] Back</Text>
          </Box>
        </PanelContent>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader>SELECT MODEL</PanelHeader>
      <PanelContent>
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

        <Box marginTop={1}>
          <Text dimColor>
            {isSearching ? "[Esc] clear search" : "[/] search  [Esc] cancel"}
          </Text>
        </Box>
      </PanelContent>
    </Panel>
  );
}

export function ModelPicker({
  provider,
  providerName,
  onSelect,
  onCancel,
  isActive = true,
  fetchOpenRouterModels,
}: ModelPickerProps): ReactElement {
  if (provider === "openrouter") {
    return (
      <OpenRouterModelPicker
        providerName={providerName}
        onSelect={onSelect}
        onCancel={onCancel}
        isActive={isActive}
        fetchOpenRouterModels={fetchOpenRouterModels}
      />
    );
  }

  const models = getModelsForProvider(provider);
  const initialIndex = models.findIndex((m) => m.recommended) ?? 0;
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialIndex));

  const options: SelectOption<string>[] = models.map((model) => ({
    id: model.id,
    label: model.name,
    description: model.description,
    badge: <TierBadge tier={model.tier} recommended={model.recommended} />,
  }));

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.escape) {
        onCancel();
      }
    },
    { isActive }
  );

  return (
    <Panel>
      <PanelHeader>SELECT MODEL</PanelHeader>
      <PanelContent>
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

        <Box marginTop={1}>
          <Text dimColor>[Enter] select  [Esc] cancel</Text>
        </Box>
      </PanelContent>
    </Panel>
  );
}
