import ReactDOM from "react-dom/client";
import { Breadcrumbs } from "../../registry/ui/breadcrumbs";
import { Callout } from "../../registry/ui/callout";
import { Checkbox } from "../../registry/ui/checkbox";
import "./coarse-hit-targets.css";

function CoarseHitTargetsFixture() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        display: "grid",
        gap: 32,
        alignContent: "start",
      }}
    >
      <section
        aria-label="Checkbox targets"
        style={{ display: "grid", gap: 16, justifyItems: "start" }}
      >
        <Checkbox data-testid="checkbox-standalone" label="Standalone checkbox" />
        <div data-testid="checkbox-adjacent-stack" style={{ display: "grid", gap: 0 }}>
          <Checkbox data-testid="checkbox-adjacent-one" label="Adjacent checkbox one" />
          <Checkbox data-testid="checkbox-adjacent-two" label="Adjacent checkbox two" />
        </div>
      </section>

      <section aria-label="Breadcrumb targets" style={{ display: "grid", gap: 12 }}>
        <Breadcrumbs data-testid="breadcrumbs-adjacent">
          <Breadcrumbs.Item>
            <Breadcrumbs.Link data-testid="breadcrumbs-home" href="/">
              Home
            </Breadcrumbs.Link>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>
            <Breadcrumbs.Link data-testid="breadcrumbs-about" href="/about">
              About
            </Breadcrumbs.Link>
          </Breadcrumbs.Item>
        </Breadcrumbs>
      </section>

      <section aria-label="Callout dismiss targets" style={{ display: "grid", gap: 16 }}>
        <Callout data-testid="callout-open">
          <Callout.Title>Open-room callout</Callout.Title>
          <Callout.Dismiss data-testid="callout-dismiss-open" />
          <Callout.Content>
            The dismiss button keeps its coarse-pointer band while title and body sit beside it.
          </Callout.Content>
        </Callout>

        <div
          data-testid="callout-clip-frame"
          style={{
            maxHeight: 96,
            overflow: "auto",
            padding: 0,
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ height: 80 }} />
          <Callout data-testid="callout-clipped">
            <Callout.Title>Clipped callout</Callout.Title>
            <Callout.Dismiss data-testid="callout-dismiss-clipped" />
            <Callout.Content>
              The same dismiss should lose its overhang once the scroller clips it.
            </Callout.Content>
          </Callout>
          <div style={{ height: 80 }} />
        </div>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<CoarseHitTargetsFixture />);
