import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { atRuleBody, eachRule, ruleBody } from "../../testing/css-contract";
import { Dialog } from "./index";

describe("Dialog prefers-reduced-motion (CSS-only)", () => {
  // dialog.css declares a @media (prefers-reduced-motion: reduce) block that
  // sets `animation: none !important` for both the <dialog> element and
  // ::backdrop. jsdom does not evaluate @media in stylesheets, so the rule's
  // declaration is extracted and injected unconditionally at the top level
  // to simulate matchMedia returning true; getComputedStyle then reports
  // the suppressed animation.
  const DIALOG_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../shared/dialog.css");
  let styleElement: HTMLStyleElement | null = null;

  beforeAll(() => {
    const sourceCss = readFileSync(DIALOG_CSS_PATH, "utf8");
    const mediaBody = atRuleBody(sourceCss, "@media (prefers-reduced-motion: reduce)");
    const declaration = ruleBody(mediaBody, "dialog, dialog::backdrop");
    if (declaration === null) {
      throw new Error(
        "dialog.css must declare a @media (prefers-reduced-motion: reduce) rule for dialog and dialog::backdrop",
      );
    }
    if (!/animation:\s*none\s*!important/.test(declaration)) {
      throw new Error(
        "dialog.css reduced-motion rule must set animation: none !important (not animation-duration: 0.01s)",
      );
    }
    // Regression guard for a concrete historical value: the rule once used
    // animation-duration: 0.01s !important, which does not suppress the animation.
    if (/animation-duration:\s*0\.01s/.test(declaration)) {
      throw new Error(
        "dialog.css reduced-motion rule must no longer use animation-duration: 0.01s !important",
      );
    }
    styleElement = document.createElement("style");
    styleElement.dataset.testSource = "dialog.css#reduced-motion";
    styleElement.textContent = `dialog { ${declaration} }`;
    document.head.appendChild(styleElement);
  });

  afterAll(() => {
    styleElement?.remove();
    styleElement = null;
  });

  it("suppresses dialog open animation under prefers-reduced-motion", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Reduced motion dialog</Dialog.Title>
          <Dialog.Close />
        </Dialog.Content>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Reduced motion dialog" });
    expect(getComputedStyle(dialog).animation).toBe("none");
  });
});

describe("DialogContent corner CSS tokens (CSS-only)", () => {
  // dialog.css declares corner accent rules nested inside @layer components.
  // jsdom's CSSOM does not apply rules inside @layer, so every rule that
  // targets [data-corners] is extracted and injected at the top level.
  // The tests then assert getComputedStyle resolves the expected --viewfinder-*
  // custom properties per corners value.
  const DIALOG_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../shared/dialog.css");
  let styleElement: HTMLStyleElement | null = null;

  beforeAll(() => {
    const sourceCss = readFileSync(DIALOG_CSS_PATH, "utf8");
    if (!sourceCss.includes('[data-corners]:not([data-corners="none"])')) {
      throw new Error(
        'dialog.css must use [data-corners]:not([data-corners="none"]) as the non-none selector',
      );
    }
    const rules = eachRule(sourceCss).filter((rule) =>
      rule.selector.includes('[data-slot="dialog-content"]'),
    );
    if (rules.length === 0) {
      throw new Error('dialog.css must declare [data-slot="dialog-content"] corner rules');
    }
    styleElement = document.createElement("style");
    styleElement.dataset.testSource = "dialog.css#corners";
    styleElement.textContent = rules
      .map((rule) => `${rule.selector.replace(/^@layer \S+ /, "")} { ${rule.declarations} }`)
      .join("\n");
    document.head.appendChild(styleElement);
  });

  afterAll(() => {
    styleElement?.remove();
    styleElement = null;
  });

  // Corner defaults live in var() fallbacks at the use sites, not on the slot, so an ancestor
  // override can reach them; tokens a variant leaves unset read as "".
  it("corners='standard' sets no per-variant tokens (all corners fall back to defaults)", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="standard">
          <Dialog.Title>Standard corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Standard corners" });
    const styles = getComputedStyle(dialog);
    expect(styles.getPropertyValue("--viewfinder-size").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-weight").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-color").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-offset").trim()).toBe("");
  });

  it("corners='subtle' overrides size/weight/color; offset falls back to 0px", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="subtle">
          <Dialog.Title>Subtle corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Subtle corners" });
    const styles = getComputedStyle(dialog);
    expect(styles.getPropertyValue("--viewfinder-size").trim()).toBe("12px");
    expect(styles.getPropertyValue("--viewfinder-weight").trim()).toBe("1.5px");
    expect(styles.getPropertyValue("--viewfinder-color").trim()).toBe("var(--border)");
    expect(styles.getPropertyValue("--viewfinder-offset").trim()).toBe("");
  });

  it("corners='bold' overrides size/weight; color/offset fall back to defaults", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="bold">
          <Dialog.Title>Bold corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Bold corners" });
    const styles = getComputedStyle(dialog);
    expect(styles.getPropertyValue("--viewfinder-size").trim()).toBe("28px");
    expect(styles.getPropertyValue("--viewfinder-weight").trim()).toBe("3px");
    expect(styles.getPropertyValue("--viewfinder-color").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-offset").trim()).toBe("");
  });

  it("corners='outset' overrides offset to -3px; size/weight/color fall back to defaults", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="outset">
          <Dialog.Title>Outset corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Outset corners" });
    const styles = getComputedStyle(dialog);
    expect(styles.getPropertyValue("--viewfinder-size").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-weight").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-color").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-offset").trim()).toBe("-3px");
  });

  it("corners='none' does not set any --viewfinder-* custom properties", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="none">
          <Dialog.Title>No corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "No corners" });
    const styles = getComputedStyle(dialog);
    expect(styles.getPropertyValue("--viewfinder-size").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-weight").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-color").trim()).toBe("");
    expect(styles.getPropertyValue("--viewfinder-offset").trim()).toBe("");
  });
});
