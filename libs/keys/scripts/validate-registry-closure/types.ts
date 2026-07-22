import { extractImportSpecifiers } from "@diffgazer/registry";

export interface ValidationError {
  code: string;
  item: string;
  message: string;
}

export function validationError(code: string, item: string, message: string): ValidationError {
  return { code, item, message };
}

export function extractRelativeImports(content: string): string[] {
  return [...new Set(extractImportSpecifiers(content).map(({ specifier }) => specifier))].filter(
    (specifier) => specifier.startsWith("."),
  );
}
