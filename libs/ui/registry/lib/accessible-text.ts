import {
  Children,
  type CSSProperties,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

interface TextContentProps {
  "aria-hidden"?: boolean | "true" | "false";
  children?: ReactNode;
  hidden?: boolean;
  style?: CSSProperties;
}

const NON_NAMING_ELEMENTS = new Set(["script", "style", "template"]);

function isHiddenFromAccessibleName(element: ReactElement<TextContentProps>): boolean {
  const { hidden, style } = element.props;
  if (hidden) return true;
  if (element.props["aria-hidden"] === true || element.props["aria-hidden"] === "true") {
    return true;
  }
  if (style?.display === "none" || style?.visibility === "hidden") return true;
  return typeof element.type === "string" && NON_NAMING_ELEMENTS.has(element.type);
}

export function hasAccessibleTextContent(node: ReactNode): boolean {
  return Children.toArray(node).some((child) => {
    if (typeof child === "string") return child.trim().length > 0;
    if (typeof child === "number" || typeof child === "bigint") return true;
    if (!isValidElement<TextContentProps>(child)) return false;
    if (isHiddenFromAccessibleName(child)) return false;
    return hasAccessibleTextContent(child.props.children);
  });
}
