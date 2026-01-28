import type { ReactNode } from "react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey } from "@/hooks/keyboard";
import { useRouteState } from "@/hooks/use-route-state";
import { useFooter } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getProviderStatus } from "@/features/settings/api/config-api";
import {
  AVAILABLE_PROVIDERS,
  GEMINI_MODEL_INFO,
  OPENAI_MODEL_INFO,
  ANTHROPIC_MODEL_INFO,
  GLM_MODEL_INFO,
  type AIProvider,
  type ProviderStatus,
  type ProviderInfo,
} from "@repo/schemas";

type ModelPreset = "fast" | "balanced" | "best";
type DisplayStatus = "configured" | "needs-key" | "active";

interface ProviderWithStatus extends ProviderInfo {
  displayStatus: DisplayStatus;
}

// Maps preset to model ID for each provider
const PRESET_MODEL_IDS: Record<AIProvider, Record<ModelPreset, string>> = {
  gemini: {
    fast: "gemini-2.5-flash-lite",
    balanced: "gemini-2.5-flash",
    best: "gemini-2.5-pro",
  },
  openai: {
    fast: "gpt-4o-mini",
    balanced: "gpt-4o",
    best: "o1-preview",
  },
  anthropic: {
    fast: "claude-3-5-haiku-20241022",
    balanced: "claude-sonnet-4-20250514",
    best: "claude-3-opus-20240229",
  },
  glm: {
    fast: "glm-4.6",
    balanced: "glm-4.7",
    best: "glm-4.7",
  },
  openrouter: {
    fast: "",
    balanced: "",
    best: "",
  },
};

// Get model info for a provider and model ID
function getModelInfo(providerId: AIProvider, modelId: string) {
  switch (providerId) {
    case "gemini":
      return GEMINI_MODEL_INFO[modelId as keyof typeof GEMINI_MODEL_INFO];
    case "openai":
      return OPENAI_MODEL_INFO[modelId as keyof typeof OPENAI_MODEL_INFO];
    case "anthropic":
      return ANTHROPIC_MODEL_INFO[modelId as keyof typeof ANTHROPIC_MODEL_INFO];
    case "glm":
      return GLM_MODEL_INFO[modelId as keyof typeof GLM_MODEL_INFO];
    default:
      return null;
  }
}

// Get preset description
function getPresetDescription(preset: ModelPreset): string {
  switch (preset) {
    case "fast":
      return "Optimized for speed. Best for quick checks and simple tasks.";
    case "balanced":
      return "Good balance of speed and quality. Best for general code review.";
    case "best":
      return "Maximum quality. Best for complex analysis and detailed reviews.";
  }
}

function getStatusBadge(status: DisplayStatus): ReactNode {
  switch (status) {
    case "active":
      return (
        <span className="text-xs font-medium text-[--tui-green]">
          [active]
        </span>
      );
    case "configured":
      return (
        <span className="text-xs font-medium text-[--tui-green]">
          [configured]
        </span>
      );
    case "needs-key":
      return (
        <span className="text-xs text-[--tui-yellow]">[needs key]</span>
      );
  }
}

const FOOTER_SHORTCUTS = [
  { key: "Up/Down", label: "Select" },
  { key: "Enter", label: "Save" },
  { key: "Esc", label: "Back" },
  { key: "a", label: "Advanced" },
];

export function SettingsProviderPage() {
  const navigate = useNavigate();
  const { setShortcuts, setRightShortcuts } = useFooter();
  const [selectedProviderIndex, setSelectedProviderIndex] = useRouteState('providerIndex', 0);
  const [selectedPreset, setSelectedPreset] = useState<ModelPreset>("balanced");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);

  // Fetch provider status from API
  useEffect(() => {
    getProviderStatus().then(setProviderStatuses).catch(console.error);
  }, []);

  // Merge AVAILABLE_PROVIDERS with status from API
  const providers: ProviderWithStatus[] = useMemo(() => {
    return AVAILABLE_PROVIDERS.filter(p => p.id !== "openrouter").map((provider) => {
      const status = providerStatuses.find((s) => s.provider === provider.id);
      let displayStatus: DisplayStatus = "needs-key";
      if (status?.isActive) {
        displayStatus = "active";
      } else if (status?.hasApiKey) {
        displayStatus = "configured";
      }
      return { ...provider, displayStatus };
    });
  }, [providerStatuses]);

  const selectedProvider = providers[selectedProviderIndex];
  const providerId = selectedProvider?.id ?? "gemini";
  const modelId = PRESET_MODEL_IDS[providerId]?.[selectedPreset] ?? "";
  const modelInfo = getModelInfo(providerId, modelId);
  const presetLabel = selectedPreset.charAt(0).toUpperCase() + selectedPreset.slice(1);

  useKey("Escape", () => navigate({ to: "/settings" }));

  const footerShortcuts = useMemo(() => FOOTER_SHORTCUTS, []);

  const rightShortcuts = useMemo(
    () => [
      {
        key: "PROV:",
        label: `${selectedProvider?.name} - MOD: ${presetLabel}`,
      },
    ],
    [selectedProvider?.name, presetLabel]
  );

  useEffect(() => {
    setShortcuts(footerShortcuts);
    setRightShortcuts(rightShortcuts);
  }, [footerShortcuts, rightShortcuts, setShortcuts, setRightShortcuts]);

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-1/3 flex flex-col border-r border-[--tui-border]">
        <div className="p-3 border-b border-[--tui-border] bg-[--tui-selection]/30">
          <h2 className="text-sm font-bold text-[--tui-fg] uppercase tracking-wide">
            Providers
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {providers.map((provider, index) => {
            const isSelected = index === selectedProviderIndex;
            return (
              <button
                type="button"
                key={provider.id}
                onClick={() => setSelectedProviderIndex(index)}
                className={cn(
                  "w-full px-3 py-2 flex justify-between items-center cursor-pointer transition-colors text-left",
                  isSelected && "bg-[--tui-blue] text-black",
                  !isSelected &&
                    "text-gray-400 hover:bg-[--tui-selection] hover:text-[--tui-fg] group"
                )}
              >
                <span
                  className={cn("flex items-center", isSelected && "font-bold")}
                >
                  <span
                    className={cn(
                      "mr-2",
                      isSelected
                        ? "text-black"
                        : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {isSelected
                      ? String.fromCharCode(9679)
                      : String.fromCharCode(9675)}
                  </span>
                  {provider.name}
                </span>
                {getStatusBadge(provider.displayStatus)}
              </button>
            );
          })}
        </div>
        <div className="p-3 text-xs text-gray-600 border-t border-[--tui-border]">
          Select a provider to configure API keys and model defaults.
        </div>
      </div>

      <div className="w-2/3 flex flex-col bg-[#0f131a]">
        <div className="p-3 border-b border-[--tui-border] bg-[--tui-selection]/30 flex justify-between">
          <h2 className="text-sm font-bold text-[--tui-fg] uppercase tracking-wide">
            {selectedProvider?.name} Configuration
          </h2>
          {selectedProvider?.displayStatus === "active" && (
            <span className="text-xs text-[--tui-green] font-mono">Active</span>
          )}
        </div>

        <div className="p-8 flex-1 flex flex-col gap-8">
          <div>
            <label className="block text-[--tui-violet] font-bold mb-4 uppercase text-xs tracking-wider">
              Model Preset
            </label>
            <div className="flex border border-[--tui-border] w-max">
              <Button
                variant={selectedPreset === "fast" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedPreset("fast")}
                className={cn(
                  "border-r border-[--tui-border] rounded-none",
                  selectedPreset !== "fast" && "text-gray-400"
                )}
              >
                [ Fast ]
              </Button>
              <Button
                variant={selectedPreset === "balanced" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedPreset("balanced")}
                className={cn(
                  "border-r border-[--tui-border] rounded-none",
                  selectedPreset !== "balanced" && "text-gray-400"
                )}
              >
                [ Balanced ]
              </Button>
              <Button
                variant={selectedPreset === "best" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedPreset("best")}
                className={cn(
                  "rounded-none",
                  selectedPreset !== "best" && "text-gray-400"
                )}
              >
                [ Best ]
              </Button>
            </div>
            <p className="mt-3 text-xs text-gray-500 max-w-md">
              <span className="text-[--tui-blue] font-bold">{presetLabel}:</span>{" "}
              Uses <span className="text-[--tui-fg]">{modelInfo?.name ?? modelId}</span>.{" "}
              {getPresetDescription(selectedPreset)}
            </p>
          </div>

          <div className="h-px bg-[--tui-border] w-full" />

          {showAdvanced && (
            <div className="space-y-4">
              <div>
                <label className="block text-[--tui-violet] font-bold mb-2 uppercase text-xs tracking-wider">
                  Model ID
                </label>
                <input
                  type="text"
                  className="bg-[--tui-bg] border border-[--tui-border] text-[--tui-fg] px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:border-[--tui-blue]"
                  placeholder={modelInfo?.name ?? modelId}
                />
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-[--tui-violet] font-bold mb-2 uppercase text-xs tracking-wider">
                    Temperature
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    className="bg-[--tui-bg] border border-[--tui-border] text-[--tui-fg] px-3 py-2 text-sm w-24 focus:outline-none focus:border-[--tui-blue]"
                    defaultValue="0.7"
                  />
                </div>
                <div>
                  <label className="block text-[--tui-violet] font-bold mb-2 uppercase text-xs tracking-wider">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="1000"
                    className="bg-[--tui-bg] border border-[--tui-border] text-[--tui-fg] px-3 py-2 text-sm w-32 focus:outline-none focus:border-[--tui-blue]"
                    defaultValue="30000"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-auto mb-4">
            <Button
              variant="link"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2"
            >
              <span className="text-[--tui-yellow] font-bold">[a]</span>
              <span className="border-b border-dashed border-gray-700 group-hover:border-[--tui-fg]">
                {showAdvanced ? "Hide" : "Show"} Advanced Settings (Model ID,
                Temp, Timeout)
              </span>
              <span className="text-sm">
                {showAdvanced ? "\u25B2" : "\u25BC"}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
