import { useFocusTrap } from "@diffgazer/keys";
import { useRef } from "react";
import ReactDOM from "react-dom/client";

function RadioGroup({ eligibleLabel }: { eligibleLabel: string }) {
  return (
    <fieldset>
      <legend>Choice</legend>
      <label>
        <input type="radio" name="choice" checked readOnly tabIndex={-1} />
        Checked but excluded
      </label>
      <label>
        <input type="radio" name="choice" aria-label={eligibleLabel} />
        {eligibleLabel}
      </label>
    </fieldset>
  );
}

function FocusTrapRadioFixture({ direction }: { direction: "forward" | "reverse" }) {
  const trapRef = useRef<HTMLDivElement>(null);
  useFocusTrap(trapRef, { restoreFocus: false });

  return (
    <div ref={trapRef}>
      {direction === "forward" ? <button type="button">Forward start</button> : null}
      <RadioGroup eligibleLabel={direction === "forward" ? "Forward peer" : "Reverse peer"} />
      {direction === "reverse" ? <button type="button">Reverse end</button> : null}
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

const direction = new URLSearchParams(window.location.search).get("direction");
ReactDOM.createRoot(root).render(
  <FocusTrapRadioFixture direction={direction === "reverse" ? "reverse" : "forward"} />,
);
