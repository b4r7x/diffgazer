import { CodeBlock as CodeBlockRoot, type CodeBlockProps } from "./code-block";
import { CodeBlockContent, type CodeBlockContentProps } from "./code-block-content";
import { CodeBlockHeader, type CodeBlockHeaderProps } from "./code-block-header";
import { CodeBlockLabel, type CodeBlockLabelProps } from "./code-block-label";
import { CodeBlockLine, type CodeBlockLineProps, type CodeBlockToken, type CodeBlockLineType } from "./code-block-line";

const CodeBlock = Object.assign(CodeBlockRoot, {
  Content: CodeBlockContent,
  Header: CodeBlockHeader,
  Label: CodeBlockLabel,
  Line: CodeBlockLine,
});

export {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLabel,
  CodeBlockLine,
  type CodeBlockProps,
  type CodeBlockContentProps,
  type CodeBlockHeaderProps,
  type CodeBlockLabelProps,
  type CodeBlockLineProps,
  type CodeBlockToken,
  type CodeBlockLineType,
};
