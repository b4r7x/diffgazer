import { StatusIndicator } from "@/components/ui/status-indicator";

const services = [
  { name: "api.diffgazer.dev", status: "online", label: "Online" },
  { name: "worker.queue", status: "busy", label: "Busy" },
  { name: "cache.redis", status: "offline", label: "Offline" },
] as const;

export default function StatusIndicatorInline() {
  return (
    <div className="w-full max-w-sm border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-xs font-bold text-foreground">SERVICES</span>
        <StatusIndicator label={null}>Operational</StatusIndicator>
      </div>
      <ul>
        {services.map((service) => (
          <li
            key={service.name}
            className="flex items-center justify-between gap-4 border-b border-border px-3 py-2 last:border-b-0"
          >
            <span className="font-mono text-xs text-foreground">{service.name}</span>
            <StatusIndicator status={service.status} label={null}>
              {service.label}
            </StatusIndicator>
          </li>
        ))}
      </ul>
    </div>
  );
}
