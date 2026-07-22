import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { joinLines } from "./smoke-shared/fixtures.mjs";

export function writeKeysPackageModeSmoke(projectDir) {
  writeFileSync(
    resolve(projectDir, "runtime-only.mjs"),
    joinLines(
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
      "for (const peer of ['@testing-library/react', '@testing-library/user-event', 'vitest']) {",
      "  let resolved = null;",
      "  try { resolved = require.resolve(peer); } catch {}",
      "  if (resolved) throw new Error(`Expected optional test peer ${peer} to be absent, but it resolved to ${resolved}`);",
      "}",
      "require.resolve('@diffgazer/keys/package.json');",
      "const keys = await import('@diffgazer/keys');",
      "if (typeof keys.KeyboardProvider !== 'function') throw new Error('Expected KeyboardProvider from the root entry');",
      "console.log('OK: @diffgazer/keys root works without optional test peers');",
      "",
    ),
  );
  writeFileSync(
    resolve(projectDir, "strict.ts"),
    joinLines(
      "import { createRef, type ComponentProps } from 'react';",
      "import { KeyboardProvider, useActionRowNavigation, useFocusTrap, useKey, useNavigation, useScope } from '@diffgazer/keys';",
      "",
      "type ProviderProps = ComponentProps<typeof KeyboardProvider>;",
      "const providerProps = { children: null } satisfies ProviderProps;",
      "",
      "function HookSmoke() {",
      "  const containerRef = createRef<HTMLDivElement>();",
      "  useScope('smoke');",
      "  useKey('mod+k', () => undefined);",
      "  useNavigation({ containerRef, role: 'option' });",
      "  useFocusTrap(containerRef, { enabled: false });",
      "  useActionRowNavigation({ enabled: true, actionCount: 1, onAction: () => undefined });",
      "  return null;",
      "}",
      "",
      "void providerProps;",
      "void HookSmoke;",
      "",
    ),
  );
  writeFileSync(
    resolve(projectDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          jsx: "react-jsx",
          skipLibCheck: false,
          noEmit: true,
        },
        include: ["strict.ts"],
      },
      null,
      2,
    ),
  );
}

export function writeKeysTestHelperSmoke(projectDir) {
  writeFileSync(
    resolve(projectDir, "helper-import.test.mjs"),
    joinLines(
      "import { testNavigationBehavior } from '@diffgazer/keys/testing/navigation-behavior';",
      "import { expect, it } from 'vitest';",
      "",
      "it('loads the documented navigation helper after its optional test peers are installed', () => {",
      "  expect(typeof testNavigationBehavior).toBe('function');",
      "});",
      "",
    ),
  );
}
