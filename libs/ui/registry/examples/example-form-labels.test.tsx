import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "../../testing/axe";
import EmptyStateLive from "./empty-state/empty-state-live";
import InputDefault from "./input/input-default";
import InputVariants from "./input/input-variants";
import SelectAvatar from "./select/select-avatar";
import SelectCard from "./select/select-card";
import SelectDefault from "./select/select-default";
import SelectDisplayModes from "./select/select-display-modes";
import SelectMultiple from "./select/select-multiple";
import SelectMultiselectSimple from "./select/select-multiselect-simple";
import SelectRadio from "./select/select-radio";
import SelectSearchTop from "./select/select-search-top";
import SelectSearchable from "./select/select-searchable";
import SelectTagsExample from "./select/select-tags";
import TextareaDefault from "./textarea/textarea-default";
import TextareaVariants from "./textarea/textarea-variants";
import ToggleGroupCounts from "./toggle-group/toggle-group-counts";
import ToggleGroupDefault from "./toggle-group/toggle-group-default";
import ToggleGroupDisabled from "./toggle-group/toggle-group-disabled";
import ToggleGroupMultiple from "./toggle-group/toggle-group-multiple";
import ToggleGroupSizes from "./toggle-group/toggle-group-sizes";
import ToggleGroupVariants from "./toggle-group/toggle-group-variants";
import ToggleGroupVertical from "./toggle-group/toggle-group-vertical";

// Only the labeling rules: F-354 is about form controls named only by a
// placeholder or the "Select" fallback, not unrelated a11y concerns.
const LABEL_RULES = {
  runOnly: {
    type: "rule" as const,
    values: [
      "label",
      "aria-input-field-name",
      "select-name",
      "aria-command-name",
      "aria-toggle-field-name",
    ],
  },
};

const examples: Array<[string, () => React.JSX.Element]> = [
  ["select-default", SelectDefault],
  ["select-avatar", SelectAvatar],
  ["select-card", SelectCard],
  ["select-display-modes", SelectDisplayModes],
  ["select-multiple", SelectMultiple],
  ["select-multiselect-simple", SelectMultiselectSimple],
  ["select-radio", SelectRadio],
  ["select-search-top", SelectSearchTop],
  ["select-searchable", SelectSearchable],
  ["select-tags", SelectTagsExample],
  ["input-default", InputDefault],
  ["input-variants", InputVariants],
  ["textarea-default", TextareaDefault],
  ["textarea-variants", TextareaVariants],
  ["toggle-group-default", ToggleGroupDefault],
  ["toggle-group-counts", ToggleGroupCounts],
  ["toggle-group-disabled", ToggleGroupDisabled],
  ["toggle-group-multiple", ToggleGroupMultiple],
  ["toggle-group-sizes", ToggleGroupSizes],
  ["toggle-group-variants", ToggleGroupVariants],
  ["toggle-group-vertical", ToggleGroupVertical],
  ["empty-state-live", EmptyStateLive],
];

describe("form-control example accessible names", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  for (const [name, Example] of examples) {
    it(`${name} has no form-label a11y violations`, async () => {
      const { container } = render(<Example />);
      expect(await axe(container, LABEL_RULES)).toHaveNoViolations();
    });
  }
});
