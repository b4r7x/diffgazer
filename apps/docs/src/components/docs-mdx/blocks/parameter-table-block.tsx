import { ParameterTable } from "@/components/docs-mdx/parameter-table";
import { useHookData } from "../doc-data-context";

export function ParameterTableBlock() {
  const data = useHookData();
  if (!data?.docs?.parameters?.length) return null;

  return <ParameterTable params={data.docs.parameters} />;
}
