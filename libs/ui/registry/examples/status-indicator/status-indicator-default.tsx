import { StatusIndicator } from "@/components/ui/status-indicator";

export default function StatusIndicatorDefault() {
  return (
    <div className="flex flex-col gap-4">
      <StatusIndicator>Online</StatusIndicator>
      <StatusIndicator status="busy">Busy</StatusIndicator>
      <StatusIndicator status="offline">Offline</StatusIndicator>
      <StatusIndicator pulse={false}>No pulse</StatusIndicator>
    </div>
  );
}
