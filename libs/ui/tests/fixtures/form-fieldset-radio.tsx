import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Checkbox } from "../../registry/ui/checkbox";
import { Radio, RadioGroup } from "../../registry/ui/radio";
import { ToggleGroup } from "../../registry/ui/toggle-group";

function FieldsetFixture() {
  const [disabled, setDisabled] = useState(true);
  const [events, setEvents] = useState(0);

  return (
    <section aria-label="Fieldset controls">
      <button type="button">Before fieldset</button>
      <form id="fieldset-form">
        <fieldset disabled={disabled}>
          <legend>
            Legend controls
            <Checkbox
              checked
              name="legend-check"
              value="yes"
              label="Legend checkbox"
              onChange={() => setEvents((count) => count + 1)}
            />
            <Radio
              checked
              name="legend-radio"
              value="yes"
              label="Legend radio"
              onChange={() => setEvents((count) => count + 1)}
            />
          </legend>
          <Checkbox
            checked
            name="outside-check"
            value="yes"
            label="Outside checkbox"
            onChange={() => setEvents((count) => count + 1)}
          />
          <Checkbox.Group
            name="fruits"
            value={["apple"]}
            label="Fruits"
            onChange={() => setEvents((count) => count + 1)}
          >
            <Checkbox.Item value="apple" label="Apple" />
            <Checkbox.Item value="banana" label="Banana" />
          </Checkbox.Group>
          <Radio
            checked
            name="outside-radio"
            value="yes"
            label="Outside radio"
            onChange={() => setEvents((count) => count + 1)}
          />
          <RadioGroup
            name="color"
            value="red"
            label="Colors"
            onChange={() => setEvents((count) => count + 1)}
          >
            <RadioGroup.Item value="red" label="Red" />
            <RadioGroup.Item value="blue" label="Blue" />
          </RadioGroup>
          <legend>
            <Checkbox checked name="second-legend" value="yes" label="Second legend checkbox" />
          </legend>
        </fieldset>
      </form>
      <button type="button" onClick={() => setDisabled((value) => !value)}>
        Toggle fieldset
      </button>
      <button type="button">After fieldset</button>
      <output aria-label="Fieldset disabled">{String(disabled)}</output>
      <output aria-label="Fieldset events">{events}</output>
    </section>
  );
}

function RadioReachabilityFixture() {
  const [hideDynamic, setHideDynamic] = useState(false);
  const ruleIndexRef = useRef<number | null>(null);
  const adoptedSheetRef = useRef<CSSStyleSheet | null>(null);

  const hideRuleSelected = () => {
    const style = document.querySelector<HTMLStyleElement>("#radio-visibility-rules");
    if (style?.sheet && ruleIndexRef.current === null) {
      ruleIndexRef.current = style.sheet.insertRule(".rule-hidden { visibility: hidden; }");
    }
  };

  const showRuleSelected = () => {
    const style = document.querySelector<HTMLStyleElement>("#radio-visibility-rules");
    if (!style?.sheet || ruleIndexRef.current === null) return;
    style.sheet.deleteRule(ruleIndexRef.current);
    ruleIndexRef.current = null;
  };

  const getAdoptedSheet = () => {
    if (adoptedSheetRef.current) return adoptedSheetRef.current;
    const sheet = new CSSStyleSheet();
    adoptedSheetRef.current = sheet;
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return sheet;
  };

  return (
    <section aria-label="Radio reachability">
      <button type="button">Initial before</button>
      <RadioGroup value="initial-red" label="Initially hidden selected">
        <div className="initially-hidden">
          <RadioGroup.Item value="initial-red" label="Initial red" />
        </div>
        <RadioGroup.Item value="initial-blue" label="Initial blue" />
      </RadioGroup>
      <button type="button">Initial after</button>

      <button type="button">Dynamic before</button>
      <div className={hideDynamic ? "hide-dynamic-selected" : undefined}>
        <RadioGroup value="dynamic-red" label="Dynamically hidden selected">
          <RadioGroup.Item value="dynamic-red" label="Dynamic red" />
          <RadioGroup.Item value="dynamic-blue" label="Dynamic blue" />
        </RadioGroup>
      </div>
      <button type="button" onClick={() => setHideDynamic((value) => !value)}>
        Toggle selected ancestor
      </button>
      <button type="button">Dynamic after</button>

      <button type="button">Rule before</button>
      <RadioGroup value="rule-red" label="Rule-hidden selected">
        <div className="rule-hidden">
          <RadioGroup.Item value="rule-red" label="Rule red" />
        </div>
        <RadioGroup.Item value="rule-blue" label="Rule blue" />
      </RadioGroup>
      <button type="button" onClick={hideRuleSelected}>
        Hide selected with insertRule
      </button>
      <button type="button" onClick={showRuleSelected}>
        Show selected with deleteRule
      </button>
      <button
        type="button"
        onClick={() => getAdoptedSheet().replaceSync(".rule-hidden { visibility: hidden; }")}
      >
        Hide selected with replaceSync
      </button>
      <button type="button" onClick={() => getAdoptedSheet().replaceSync("")}>
        Show selected with replaceSync
      </button>
      <button
        type="button"
        onClick={() => getAdoptedSheet().replace(".rule-hidden { visibility: hidden; }")}
      >
        Hide selected with replace
      </button>
      <button type="button" onClick={() => getAdoptedSheet().replace("")}>
        Show selected with replace
      </button>
      <button type="button">Rule after</button>
    </section>
  );
}

function ServerSeedTabOrderFixture() {
  return (
    <section aria-label="Server seed Tab order">
      <button type="button">Seed before</button>
      <RadioGroup label="Selected radio seed" defaultValue="selected-radio">
        <RadioGroup.Item value="first-radio" label="First radio" />
        <RadioGroup.Item value="selected-radio" label="Selected radio" />
      </RadioGroup>
      <RadioGroup label="Fallback radio seed">
        <RadioGroup.Item value="disabled-radio" label="Disabled radio" disabled />
        <RadioGroup.Item value="fallback-radio" label="Fallback radio" />
      </RadioGroup>
      <ToggleGroup label="Selected toggle seed" defaultValue="selected-toggle">
        <ToggleGroup.Item value="first-toggle">First toggle</ToggleGroup.Item>
        <ToggleGroup.Item value="selected-toggle">Selected toggle</ToggleGroup.Item>
      </ToggleGroup>
      <ToggleGroup label="Fallback toggle seed">
        <ToggleGroup.Item value="disabled-toggle" disabled>
          Disabled toggle
        </ToggleGroup.Item>
        <ToggleGroup.Item value="fallback-toggle">Fallback toggle</ToggleGroup.Item>
      </ToggleGroup>
      <button type="button">Seed after</button>
    </section>
  );
}

function App() {
  return (
    <>
      <FieldsetFixture />
      <RadioReachabilityFixture />
      <ServerSeedTabOrderFixture />
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<App />);
