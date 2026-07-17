import ReactDOM from "react-dom/client";
import { Checkbox } from "../../registry/ui/checkbox";
import { Radio, RadioGroup } from "../../registry/ui/radio";
import { Switch } from "../../registry/ui/switch";

function ValidationFixtures() {
  return (
    <>
      <form id="checkbox-form">
        <Checkbox name="terms" value="accepted" required label="Accept terms" />
      </form>
      <form id="switch-form">
        <Switch name="alerts" value="enabled" required aria-label="Enable alerts" />
      </form>
      <form id="radio-form">
        <Radio name="standalone" value="chosen" required label="Choose standalone" />
      </form>
      <form id="checkbox-group-form">
        <Checkbox.Group name="fruits" required label="Fruits">
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>
      <form id="named-radio-group-form">
        <RadioGroup name="color" required label="Color">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
      <form id="unnamed-radio-group-form">
        <RadioGroup required label="Delivery">
          <RadioGroup.Item value="standard" label="Standard" />
          <RadioGroup.Item value="express" label="Express" />
        </RadioGroup>
      </form>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<ValidationFixtures />);
