"use client";

import { CodeBlock as CodeBlockRoot, type CodeBlockProps } from "./code-block";
import { CodeBlockContent, type CodeBlockContentProps } from "./code-block-content";
import { CodeBlockHeader, type CodeBlockHeaderProps } from "./code-block-header";
import { CodeBlockLabel, type CodeBlockLabelProps } from "./code-block-label";
import {
  CodeBlockLine,
  type CodeBlockLineProps,
  type CodeBlockToken,
  type CodeBlockLineState,
} from "./code-block-line";
import { CodeBlockCopyButton, type CodeBlockCopyButtonProps } from "./code-block-copy-button";
import type { CodeBlockVariant } from "./code-block-context";
import { InlineCode } from "./inline-code";

const CodeBlock = Object.assign(CodeBlockRoot, {
  Content: CodeBlockContent,
  Header: CodeBlockHeader,
  Label: CodeBlockLabel,
  Line: CodeBlockLine,
  CopyButton: CodeBlockCopyButton,
  Inline: InlineCode,
});

export {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLabel,
  CodeBlockLine,
  CodeBlockCopyButton,
  InlineCode,
  type CodeBlockProps,
  type CodeBlockContentProps,
  type CodeBlockHeaderProps,
  type CodeBlockLabelProps,
  type CodeBlockLineProps,
  type CodeBlockCopyButtonProps,
  type CodeBlockToken,
  type CodeBlockLineState,
  type CodeBlockVariant,
};
