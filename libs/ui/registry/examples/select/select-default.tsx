import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

export default function SelectDefault() {
  return (
    <div className="w-64">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select a branch..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="main">main</SelectItem>
          <SelectItem value="develop">develop</SelectItem>
          <SelectItem value="feature/auth">feature/auth</SelectItem>
          <SelectItem value="fix/typo">fix/typo</SelectItem>
          <SelectItem value="release/v2">release/v2</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
