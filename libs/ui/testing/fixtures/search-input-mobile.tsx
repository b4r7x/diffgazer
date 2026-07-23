import ReactDOM from "react-dom/client";
import { SearchInput } from "../../registry/ui/search-input";

function SearchInputMobileFixture() {
  return (
    <>
      <SearchInput size="sm" aria-label="Small search" />
      <SearchInput size="md" aria-label="Medium search" />
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<SearchInputMobileFixture />);
