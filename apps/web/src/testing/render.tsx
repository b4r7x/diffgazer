import { render, type RenderOptions } from "@testing-library/react";
import { KeyboardProvider } from "@diffgazer/keys";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ReactElement } from "react";

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <FooterProvider>
        <KeyboardProvider>{children}</KeyboardProvider>
      </FooterProvider>
    ),
    ...options,
  });
}
