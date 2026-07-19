import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const themeBaseCss = readFileSync(resolve(import.meta.dirname, "../styles/theme-base.css"), "utf8");

describe("scrollbar capability styles", () => {
  it("only suppresses scrollbar indicators on devices that can hover", () => {
    const capabilityRuleStart = themeBaseCss.indexOf("@media (hover: hover)");
    const animationRulesStart = themeBaseCss.indexOf("@keyframes ui-blink");
    const defaultCapabilityStyles = themeBaseCss.slice(0, capabilityRuleStart);
    const hoverCapabilityStyles = themeBaseCss.slice(capabilityRuleStart, animationRulesStart);

    expect(capabilityRuleStart).toBeGreaterThan(-1);
    expect(animationRulesStart).toBeGreaterThan(capabilityRuleStart);
    expect(defaultCapabilityStyles).not.toContain(".scrollbar-hide");
    expect(defaultCapabilityStyles).not.toContain(".scrollbar-thin");
    expect(hoverCapabilityStyles).toContain(".scrollbar-hide");
    expect(hoverCapabilityStyles).toContain("scrollbar-width: none");
    expect(hoverCapabilityStyles).toContain(".scrollbar-thin");
    expect(hoverCapabilityStyles).toContain("scrollbar-color: transparent transparent");
  });
});
