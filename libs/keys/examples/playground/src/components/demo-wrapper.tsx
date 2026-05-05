import type { ReactNode } from "react";
import { Kbd } from "./kbd";

interface Hint {
  keys: string;
  label: string;
}

interface DemoWrapperProps {
  title: string;
  description: string;
  hints: Hint[];
  activeScope?: string;
  children: ReactNode;
}

export function DemoWrapper({
  title,
  description,
  hints,
  activeScope,
  children,
}: DemoWrapperProps) {
  return (
    <div className="demo-wrapper">
      <div className="demo-wrapper__header">
        <h1 className="demo-wrapper__title">{title}</h1>
        {activeScope && (
          <span className="demo-wrapper__scope">{activeScope}</span>
        )}
      </div>
      <p className="demo-wrapper__description">{description}</p>
      <div className="demo-wrapper__content">{children}</div>
      {hints.length > 0 && (
        <div className="demo-wrapper__hints">
          <div className="demo-wrapper__hints-title">What to try</div>
          {hints.map((hint, i) => (
            <div key={i} className="demo-wrapper__hint">
              <Kbd keys={hint.keys} />
              <span>{hint.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
