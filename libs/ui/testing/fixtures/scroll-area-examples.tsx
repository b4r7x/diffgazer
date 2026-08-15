import ReactDOM from "react-dom/client";
import ScrollAreaBoth from "../../registry/examples/scroll-area/scroll-area-both";
import ScrollAreaHorizontal from "../../registry/examples/scroll-area/scroll-area-horizontal";
import ScrollAreaKeyboard from "../../registry/examples/scroll-area/scroll-area-keyboard";
import "./scroll-area-examples.css";

function ScrollAreaExamplesFixture() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-8 p-4">
      <section aria-label="Keyboard scroll demo">
        <ScrollAreaKeyboard />
      </section>
      <section aria-label="Horizontal scroll demo">
        <ScrollAreaHorizontal />
      </section>
      <section aria-label="Both-axis scroll demo">
        <ScrollAreaBoth />
      </section>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<ScrollAreaExamplesFixture />);
