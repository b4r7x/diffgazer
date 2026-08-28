import { screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Checkbox } from "../checkbox/index";
import { Input } from "../input/index";
import { Radio } from "../radio/index";
import { Field } from "./index";

describe("Field server output before hydration", () => {
  const ssrContainers: HTMLElement[] = [];

  function mountStaticMarkup(html: string) {
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    ssrContainers.push(container);
    return container;
  }

  afterEach(() => {
    while (ssrContainers.length > 0) ssrContainers.pop()?.remove();
  });

  it("wires native label and aria-labelledby to the control in SSR output before hydration", () => {
    const html = renderToStaticMarkup(
      <Field controlId="ssr-test">
        <Field.Label>Username</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    const input = screen.getByRole("textbox", { name: "Username" });
    expect(input).toHaveAttribute("id", "ssr-test");
    expect(input).toHaveAttribute("aria-labelledby", "ssr-test-label");
    expect(screen.getByText("Username")).toHaveAttribute("for", "ssr-test");
  });

  it("preserves aria-label for an empty Field.Label in SSR output", () => {
    const html = renderToStaticMarkup(
      <Field controlId="ssr-empty-label">
        <Field.Label>{""}</Field.Label>
        <Field.Control>
          <Input aria-label="SSR fallback" />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    expect(screen.getByRole("textbox", { name: "SSR fallback" })).not.toHaveAttribute(
      "aria-labelledby",
    );
  });

  it("names a div-based Checkbox via aria-labelledby in SSR output before hydration", () => {
    const html = renderToStaticMarkup(
      <Field controlId="accept">
        <Field.Label>Accept terms</Field.Label>
        <Field.Control>
          <Checkbox />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument();
  });

  it("names a div-based Radio via aria-labelledby in SSR output before hydration", () => {
    const html = renderToStaticMarkup(
      <Field controlId="plan">
        <Field.Label>Pro plan</Field.Label>
        <Field.Control>
          <Radio />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    expect(screen.getByRole("radio", { name: "Pro plan" })).toBeInTheDocument();
  });

  it("wires aria-describedby to the control in SSR output for description and error", () => {
    const html = renderToStaticMarkup(
      <Field invalid controlId="email">
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use your work email.</Field.Description>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    );
    mountStaticMarkup(html);

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAccessibleDescription("Email is required. Use your work email.");
  });

  it("follows a child control's own id from the label in SSR output before hydration", () => {
    const html = renderToStaticMarkup(
      <Field controlId="field-default">
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input id="custom" />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    const input = screen.getByRole("textbox", { name: "Project name" });
    expect(input).toHaveAttribute("id", "custom");
    expect(screen.getByText("Project name")).toHaveAttribute("for", "custom");
  });
});
