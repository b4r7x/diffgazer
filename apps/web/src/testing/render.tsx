import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import type { ReactElement } from "react";

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, {
    wrapper: ({ children }) => (
      <FooterProvider>
        <KeyboardProvider>{children}</KeyboardProvider>
      </FooterProvider>
    ),
    ...options,
  });
}
