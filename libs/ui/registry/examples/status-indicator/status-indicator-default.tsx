import { StatusIndicator } from "@/components/ui/status-indicator";

export default function StatusIndicatorDefault() {
  return (
    <div className="flex flex-col gap-4">
      <StatusIndicator label={null}>Online</StatusIndicator>
      <StatusIndicator status="busy" label={null}>
        Busy
      </StatusIndicator>
      <StatusIndicator status="offline" label={null}>
        Offline
      </StatusIndicator>
      <StatusIndicator pulse={false}>No pulse</StatusIndicator>
    </div>
  );
}
