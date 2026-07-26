import { Component, type ReactNode } from "react";

/**
 * The docs shell's single render-error boundary. A class is still the only way
 * to catch a render error, so every surface renders this one and supplies its
 * own fallback instead of repeating the boilerplate.
 */
export class ErrorBoundary extends Component<
  Readonly<{ fallback: ReactNode; children: ReactNode }>,
  Readonly<{ failed: boolean }>
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
