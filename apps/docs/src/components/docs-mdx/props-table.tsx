import { Typography } from "@diffgazer/ui/components/typography";
import type { PropInfo } from "@/types/data";
import { ParameterTable } from "./parameter-table";

interface PropsTableProps {
  componentName: string;
  props: Record<string, PropInfo>;
}

export function PropsTable({ componentName, props }: PropsTableProps) {
  const entries = Object.entries(props);
  if (entries.length === 0) return null;

  const params = entries.map(([name, info]) => ({
    name,
    type: info.type,
    required: info.required,
    defaultValue: info.defaultValue,
    description: info.description,
  }));

  return (
    <div>
      <Typography
        as="h3"
        size="sm"
        id={componentName.toLowerCase().replace(/\./g, "-")}
        className="mb-3 font-bold text-foreground scroll-mt-16"
      >
        {componentName}
      </Typography>
      <ParameterTable params={params} />
    </div>
  );
}
