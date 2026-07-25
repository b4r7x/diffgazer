import { BlockBar } from "@/components/ui/block-bar";

export default function BlockBarStats() {
  const max = 45;
  return (
    <div className="flex flex-col gap-2">
      <BlockBar label="Total" value={45} max={max} />
      <BlockBar label="Passed" value={38} max={max} variant="success" />
      <BlockBar label="Info" value={27} max={max} variant="info" />
      <BlockBar label="Warnings" value={12} max={max} variant="warning" />
      <BlockBar label="Errors" value={3} max={max} variant="error" />
      <BlockBar label="Style" value={3} max={max} variant="muted" />
    </div>
  );
}
