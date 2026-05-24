import { describe, expect, it } from "vitest";
import { validateDependencyProtocol } from "../cli/package-manager.js";

describe("validateDependencyProtocol", () => {
  const validDeps = [
    "react",
    "react@19",
    "@diffgazer/ui",
    "@diffgazer/ui@^1.0.0",
    "lodash.debounce",
    "my-pkg@latest",
  ];

  it.each(validDeps)("accepts valid npm dependency: %s", (dep) => {
    expect(() => validateDependencyProtocol(dep)).not.toThrow();
  });

  const rejectedDeps = [
    { dep: "file:../local-pkg", reason: "file: protocol" },
    { dep: "file:/absolute/path", reason: "file: with absolute path" },
    { dep: "git+ssh://git@github.com:user/repo.git", reason: "git+ssh protocol" },
    { dep: "git+https://github.com/user/repo.git", reason: "git+https protocol" },
    { dep: "git://github.com/user/repo.git", reason: "git: protocol" },
    { dep: "https://registry.example.com/pkg.tgz", reason: "https: protocol" },
    { dep: "http://registry.example.com/pkg.tgz", reason: "http: protocol" },
    { dep: "../evil-package", reason: "path traversal" },
    { dep: "foo/../bar", reason: "embedded path traversal" },
    { dep: "/etc/passwd", reason: "absolute unix path" },
    { dep: "\\\\server\\share", reason: "absolute windows path" },
  ];

  it.each(rejectedDeps)("rejects $reason: $dep", ({ dep }) => {
    expect(() => validateDependencyProtocol(dep)).toThrow(/Rejected dependency/);
  });
});
