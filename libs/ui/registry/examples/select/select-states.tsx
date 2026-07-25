import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const branches = ["main", "develop", "release/v2"];

function BranchSelect({
  label,
  disabled,
  invalid,
}: {
  label: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      <Select disabled={disabled} aria-invalid={invalid}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Select a branch..." />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch} value={branch}>
              {branch}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function SelectStates() {
  return (
    <div className="flex flex-col gap-4 w-64">
      <BranchSelect label="disabled" disabled />
      <BranchSelect label="aria-invalid" invalid />
    </div>
  );
}
