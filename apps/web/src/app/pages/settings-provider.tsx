import type { ReactNode } from "react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey } from "@/hooks/keyboard";
import { useRouteState } from "@/hooks/use-route-state";
import { useFooter } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModelPreset = "fast" | "balanced" | "best";
type ProviderStatus = "configured" | "needs-key" | "local";

interface Provider {
  id: string;
  name: string;
  status: ProviderStatus;
}

const PROVIDERS: Provider[] = [
  { id: "gemini", name: "Gemini", status: "configured" },
  { id: "openai", name: "OpenAI", status: "needs-key" },
  { id: "anthropic", name: "Anthropic", status: "needs-key" },
  { id: "openai-compatible", name: "OpenAI-compatible", status: "local" },
];

const PRESET_DESCRIPTIONS: Record<
  string,
  Record<ModelPreset, { model: string; description: string }>
> = {
  gemini: {
    fast: {
      model: "Gemini 1.5 Flash",
      description: "Optimized for speed. Best for quick checks and simple tasks.",
    },
    balanced: {
      model: "Gemini 1.5 Flash",
      description:
        "Good for general code review, quick fixes, and standard refactoring tasks.",
    },
    best: {
      model: "Gemini 1.5 Pro",
      description:
        "Maximum quality. Best for complex analysis and detailed reviews.",
    },
  },
  openai: {
    fast: {
      model: "GPT-4o-mini",
      description: "Optimized for speed. Best for quick checks and simple tasks.",
    },
    balanced: {
      model: "GPT-4o",
      description:
        "Good for general code review, quick fixes, and standard refactoring tasks.",
    },
    best: {
      model: "GPT-4o",
      description:
        "Maximum quality. Best for complex analysis and detailed reviews.",
    },
  },
  anthropic: {
    fast: {
      model: "Claude 3.5 Haiku",
      description: "Optimized for speed. Best for quick checks and simple tasks.",
    },
    balanced: {
      model: "Claude 3.5 Sonnet",
      description:
        "Good for general code review, quick fixes, and standard refactoring tasks.",
    },
    best: {
      model: "Claude 3 Opus",
      description:
        "Maximum quality. Best for complex analysis and detailed reviews.",
    },
  },
  "openai-compatible": {
    fast: {
      model: "Local Model",
      description: "Use your locally configured model for fast inference.",
    },
    balanced: {
      model: "Local Model",
      description: "Use your locally configured model with default settings.",
    },
    best: {
      model: "Local Model",
      description: "Use your locally configured model with quality settings.",
    },
  },
};

function getStatusBadge(status: ProviderStatus): ReactNode {
  switch (status) {
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
    case "local":
      return <span className="text-xs text-gray-600">[ local/other ]</span>;
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

  useKey("Escape", () => navigate({ to: "/settings" }));

  const selectedProvider = PROVIDERS[selectedProviderIndex];
  const providerId = selectedProvider?.id ?? "gemini";
  const presetInfo = PRESET_DESCRIPTIONS[providerId][selectedPreset];
  const presetLabel =
    selectedPreset.charAt(0).toUpperCase() + selectedPreset.slice(1);

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
          {PROVIDERS.map((provider, index) => {
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
                {getStatusBadge(provider.status)}
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
          {selectedProvider?.status === "configured" && (
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
              Uses <span className="text-[--tui-fg]">{presetInfo.model}</span>.{" "}
              {presetInfo.description}
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
                  placeholder={presetInfo.model}
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
