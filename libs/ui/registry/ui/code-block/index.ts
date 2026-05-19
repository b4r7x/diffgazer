"use client";

import { CodeBlock as CodeBlockRoot, codeBlockVariants, type CodeBlockProps } from "./code-block";
import { CodeBlockContent, type CodeBlockContentProps, type CodeBlockContentTone } from "./code-block-content";
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

const CodeBlock = Object.assign(CodeBlockRoot, {
  Content: CodeBlockContent,
  Header: CodeBlockHeader,
  Label: CodeBlockLabel,
  Line: CodeBlockLine,
  CopyButton: CodeBlockCopyButton,
});

export {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLabel,
  CodeBlockLine,
  CodeBlockCopyButton,
  codeBlockVariants,
  type CodeBlockProps,
  type CodeBlockContentProps,
  type CodeBlockContentTone,
  type CodeBlockHeaderProps,
  type CodeBlockLabelProps,
  type CodeBlockLineProps,
  type CodeBlockCopyButtonProps,
  type CodeBlockToken,
  type CodeBlockLineState,
  type CodeBlockVariant,
};
