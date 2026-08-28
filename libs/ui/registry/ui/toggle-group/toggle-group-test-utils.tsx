import { type RenderResult, render, screen } from "@testing-library/react";
import { ToggleGroup } from "./index";

export type ToggleGroupSingleComponentProps = Extract<
  React.ComponentProps<typeof ToggleGroup>,
  { selectionMode?: "single" | undefined }
>;

export function getForm(name = "Test form"): HTMLFormElement {
  const form = screen.getByRole("form", { name });
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element");
  return form;
}

export function renderGroup(props: Partial<ToggleGroupSingleComponentProps> = {}): RenderResult {
  return render(
    <ToggleGroup label="Options" {...props}>
      <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
      <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
    </ToggleGroup>,
  );
}

export function getRadios() {
  return screen.getAllByRole("radio");
}
