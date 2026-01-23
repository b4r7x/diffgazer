import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { useInput } from "ink";
import {
  SettingsMainView,
  SettingsDeleteConfirm,
  SettingsLoading,
  SettingsError,
  SettingsDeleting,
  SettingsDeleteSuccess,
} from "../../components/settings/index.js";

interface SettingsScreenProps {
  provider: string;
  model?: string;
  settingsState: "idle" | "loading" | "success" | "error";
  deleteState: "idle" | "deleting" | "success" | "error";
  error?: { message: string } | null;
  onDelete: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  provider,
  model,
  settingsState,
  deleteState,
  error,
  onDelete,
  onBack,
}: SettingsScreenProps): ReactElement {
  const [step, setStep] = useState<"view" | "confirm_delete">("view");

  useEffect(() => {
    if (deleteState !== "success") return;
    const timer = setTimeout(onBack, 1500);
    return () => clearTimeout(timer);
  }, [deleteState, onBack]);

  useInput((input) => {
    if (deleteState === "deleting") return;

    if (deleteState === "error") {
      if (input === "r") onDelete();
      if (input === "b") onBack();
      return;
    }

    if (step === "view") {
      if (input === "d") setStep("confirm_delete");
      if (input === "b") onBack();
      return;
    }

    if (step === "confirm_delete") {
      if (input === "y") onDelete();
      if (input === "n") setStep("view");
    }
  });

  if (settingsState === "loading") {
    return <SettingsLoading />;
  }

  if (settingsState === "error") {
    return (
      <SettingsError
        message="Failed to load settings"
        errorDetail={error?.message}
        actions="[b] Back"
      />
    );
  }

  if (deleteState === "deleting") {
    return <SettingsDeleting />;
  }

  if (deleteState === "success") {
    return <SettingsDeleteSuccess />;
  }

  if (deleteState === "error") {
    return (
      <SettingsError
        message="Failed to delete configuration"
        errorDetail={error?.message}
        actions="[r] Retry  [b] Back"
      />
    );
  }

  if (step === "confirm_delete") {
    return <SettingsDeleteConfirm />;
  }

  return <SettingsMainView provider={provider} model={model} />;
}
