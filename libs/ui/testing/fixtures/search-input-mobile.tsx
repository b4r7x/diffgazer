import ReactDOM from "react-dom/client";
import { Input, InputGroup } from "../../registry/ui/input";
import { SearchInput } from "../../registry/ui/search-input";

// All three shells consume the same inputSizeClasses, so all three carry the same
// iOS-zoom guard and all three belong in the only browser test that can observe it.
function InputMobileFontSizeFixture() {
  return (
    <>
      <SearchInput size="sm" aria-label="Small search" />
      <SearchInput size="md" aria-label="Medium search" />
      <Input size="sm" aria-label="Small input" />
      <Input size="md" aria-label="Medium input" />
      <InputGroup size="sm" aria-label="Small input group" prefix="$" />
      <InputGroup size="md" aria-label="Medium input group" prefix="$" />
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<InputMobileFontSizeFixture />);
