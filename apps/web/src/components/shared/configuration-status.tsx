import { CenteredStatus } from "./centered-status";

export function ConfigurationStatus({ status }: { status: "loading" | "error" }) {
  if (status === "error") {
    return <CenteredStatus tone="error">Configuration unavailable.</CenteredStatus>;
  }

  return <CenteredStatus>Loading configuration...</CenteredStatus>;
}
