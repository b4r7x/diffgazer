import { useFocusTrap } from "@diffgazer/keys";
import { useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Popover } from "../../registry/ui/popover";
import { Select } from "../../registry/ui/select";
import { Tooltip } from "../../registry/ui/tooltip";

type BoundaryMode = "controlled" | "uncontrolled";
type ActivationMode = "keyboard" | "pointer" | "programmatic";

function NativeTabFixture() {
  return (
    <Popover defaultOpen>
      <Popover.Trigger>Native tab trigger</Popover.Trigger>
      <Popover.Content role="dialog" aria-label="Native tab content">
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </Popover.Content>
    </Popover>
  );
}

function BoundaryFixture({
  mode,
  activation,
  refuseClose = false,
}: {
  mode: BoundaryMode;
  activation: ActivationMode;
  refuseClose?: boolean;
}) {
  const initiallyOpen = activation === "programmatic";
  const [open, setOpen] = useState(initiallyOpen);
  const [closeRequests, setCloseRequests] = useState(0);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setCloseRequests((count) => count + 1);
    if (mode === "controlled" && !refuseClose) setOpen(nextOpen);
  };
  const stateProps =
    mode === "controlled"
      ? { open: refuseClose || open, onOpenChange: handleOpenChange }
      : { defaultOpen: initiallyOpen, onOpenChange: handleOpenChange };

  return (
    <div>
      <Popover {...stateProps}>
        <Popover.Trigger>Boundary trigger</Popover.Trigger>
        <Popover.Content autoFocus={false} aria-label="Boundary content">
          <button type="button">Boundary action</button>
        </Popover.Content>
      </Popover>
      <button type="button">Outside</button>
      <output aria-label="Close requests">{closeRequests}</output>
    </div>
  );
}

function NestedFixture() {
  const [parentCloseRequests, setParentCloseRequests] = useState(0);
  return (
    <Popover
      defaultOpen
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setParentCloseRequests((count) => count + 1);
      }}
    >
      <Popover.Trigger>Parent trigger</Popover.Trigger>
      <Popover.Content autoFocus={false}>
        <Popover defaultOpen>
          <Popover.Trigger>Nested trigger</Popover.Trigger>
          <Popover.Content autoFocus={false}>
            <button id="nested-action" type="button">
              Nested portaled action
            </button>
          </Popover.Content>
        </Popover>
      </Popover.Content>
      <output aria-label="Parent close requests">{parentCloseRequests}</output>
    </Popover>
  );
}

function DisabledTooltipFixture() {
  return (
    <div>
      <button type="button">Before disabled tooltip</button>
      <Tooltip content="Unavailable while the review is running" delayMs={0} closeDelayMs={0}>
        <button id="disabled-tooltip-button" type="button" disabled>
          Retry review
        </button>
      </Tooltip>
      <button type="button">After disabled tooltip</button>
    </div>
  );
}

function CrossDocumentAriaFixture() {
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);

  return (
    <div>
      <iframe
        title="Foreign portal target"
        ref={(frame) => {
          setPortalContainer(frame?.contentDocument?.body ?? null);
        }}
      />
      <Popover defaultOpen triggerMode="hover">
        <Popover.Trigger>Cross-document help</Popover.Trigger>
        <Popover.Content portalContainer={portalContainer}>Help text</Popover.Content>
      </Popover>
      <Select defaultOpen>
        <Select.Trigger aria-label="Cross-document choice">
          <Select.Value placeholder="Choose" />
        </Select.Trigger>
        <Select.Content portalContainer={portalContainer}>
          <Select.Item value="one">One</Select.Item>
        </Select.Content>
      </Select>
    </div>
  );
}

function VisibilityOverrideFocusTrapFixture() {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, { restoreFocus: false });

  return (
    <>
      <div ref={containerRef}>
        <div style={{ display: "none" }}>
          <button type="button">Display none action</button>
        </div>
        <div style={{ visibility: "hidden" }}>
          <button type="button" style={{ visibility: "visible" }}>
            Visible override action
          </button>
        </div>
        <button type="button">Next action</button>
      </div>
      <button type="button">Outside trap</button>
    </>
  );
}

const search = new URLSearchParams(window.location.search);
const scenario = search.get("case");
const requestedActivation = search.get("activation");
const activation: ActivationMode =
  requestedActivation === "keyboard" || requestedActivation === "pointer"
    ? requestedActivation
    : "programmatic";
let fixture = <NativeTabFixture />;
if (scenario === "controlled" || scenario === "uncontrolled") {
  fixture = <BoundaryFixture mode={scenario} activation={activation} />;
} else if (scenario === "refuse-close") {
  fixture = <BoundaryFixture mode="controlled" activation="programmatic" refuseClose />;
} else if (scenario === "nested") {
  fixture = <NestedFixture />;
} else if (scenario === "tooltip-disabled") {
  fixture = <DisabledTooltipFixture />;
} else if (scenario === "cross-document-aria") {
  fixture = <CrossDocumentAriaFixture />;
} else if (scenario === "visibility-override-trap") {
  fixture = <VisibilityOverrideFocusTrapFixture />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(fixture);
