import ReactDOM from "react-dom/client";
import { Input, InputGroup } from "../../registry/ui/input";
import "./input-forced-colors.css";

function InputForcedColorsFixture() {
  return (
    <main className="ui-base flex min-h-screen flex-col gap-4 bg-background p-6 text-foreground">
      <section className="flex flex-col gap-2">
        <span className="text-sm">Standalone input</span>
        <Input aria-label="Standalone input" defaultValue="diffgazer" />
      </section>
      <section className="flex flex-col gap-2">
        <span className="text-sm">Grouped input</span>
        <InputGroup aria-label="Grouped input" prefix="~/" suffix=".json" defaultValue="config" />
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<InputForcedColorsFixture />);
