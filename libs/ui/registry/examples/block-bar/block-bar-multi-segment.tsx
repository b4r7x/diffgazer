import { BlockBar } from "@/components/ui/block-bar";

export default function BlockBarMultiSegment() {
  return (
    <BlockBar
      max={100}
      label="Coverage"
      segments={[
        { value: 60, variant: "success" },
        { value: 25, variant: "warning" },
        { value: 15, variant: "error" },
      ]}
      aria-valuetext="60 passed, 25 warnings, 15 failures"
    />
  );
}
