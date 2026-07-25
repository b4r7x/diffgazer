import { SearchInput } from "@/components/ui/search-input";

export default function SearchInputStates() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <SearchInput size="sm" placeholder="Small" aria-label="Small search" />
      <SearchInput size="md" placeholder="Medium (default)" aria-label="Medium search" />
      <SearchInput size="lg" placeholder="Large" aria-label="Large search" />
      <SearchInput aria-invalid placeholder="Invalid" aria-label="Invalid search" />
      <SearchInput disabled placeholder="Disabled" aria-label="Disabled search" />
    </div>
  );
}
