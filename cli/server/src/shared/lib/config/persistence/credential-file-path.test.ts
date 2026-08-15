import { chmod, lstat, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { homePath } from "./persistence.test-support.js";

const loadModule = () => import("./credential-file-path.js");

const withOutsideDirectory = async (
  run: (outside: string) => Promise<void>,
): Promise<{ outside: string; entries: string[] }> => {
  const outside = await mkdtemp(join(tmpdir(), "diffgazer-credential-outside-"));
  try {
    await run(outside);
    return { outside, entries: await readdir(outside) };
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
};

describe("credential file paths", () => {
  it("derives the app-owned V2 destination from configuration identity", async () => {
    const { literalCredentialFilePath } = await loadModule();

    expect(literalCredentialFilePath("config-a", 2)).toBe(
      homePath("credentials", "config-a-2.key"),
    );
  });

  it("accepts a path inside the app directory and creates its directory 0700 on demand", async () => {
    const { literalCredentialFilePath, resolveContainedCredentialPath } = await loadModule();
    const target = literalCredentialFilePath("config-a", 1);

    await expect(resolveContainedCredentialPath(target)).resolves.toBe(target);
    await expect(resolveContainedCredentialPath(target, { createDirectory: true })).resolves.toBe(
      target,
    );
    expect((await lstat(homePath("credentials"))).mode & 0o777).toBe(0o700);
  });

  it.each([
    { name: "a relative path", path: () => join("credentials", "relative.key") },
    { name: "a traversal escape", path: () => homePath("credentials", "..", "..", "escaped.key") },
    { name: "an absolute escape", path: () => join(tmpdir(), "absolute-escape.key") },
    { name: "the app directory itself", path: () => homePath() },
    { name: "another app-owned file in the app directory", path: () => homePath("config.json") },
  ])("rejects $name with a path-free error", async ({ path }) => {
    const { resolveContainedCredentialPath } = await loadModule();
    const candidate = path();

    const failure = await resolveContainedCredentialPath(candidate).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(
      "Credential file path is outside the Diffgazer credentials directory",
    );
  });

  it("rejects a credential directory symlinked out of the app directory without following it", async () => {
    const { literalCredentialFilePath, resolveContainedCredentialPath } = await loadModule();
    const { entries } = await withOutsideDirectory(async (outside) => {
      await writeFile(join(outside, "victim.key"), "external-victim", { mode: 0o600 });
      await symlink(outside, homePath("credentials"));
      const target = literalCredentialFilePath("config-a", 1);

      await expect(resolveContainedCredentialPath(target)).rejects.toThrow(
        "Credential file path is outside the Diffgazer credentials directory",
      );
      await expect(
        resolveContainedCredentialPath(target, { createDirectory: true }),
      ).rejects.toThrow("Credential file path is outside the Diffgazer credentials directory");
    });

    expect(entries).toEqual(["victim.key"]);
    expect((await lstat(homePath("credentials"))).isSymbolicLink()).toBe(true);
  });

  it("tightens a credentials directory an earlier build left group and other readable", async () => {
    const { literalCredentialFilePath, resolveContainedCredentialPath } = await loadModule();
    await mkdir(homePath("credentials"), { recursive: true });
    await chmod(homePath("credentials"), 0o755);

    await resolveContainedCredentialPath(literalCredentialFilePath("config-a", 1), {
      createDirectory: true,
    });

    expect((await lstat(homePath("credentials"))).mode & 0o777).toBe(0o700);
  });

  it("rejects a credential directory replaced by a file", async () => {
    const { literalCredentialFilePath, resolveContainedCredentialPath } = await loadModule();
    await mkdir(homePath(), { recursive: true });
    await writeFile(homePath("credentials"), "not-a-directory");

    await expect(
      resolveContainedCredentialPath(literalCredentialFilePath("config-a", 1)),
    ).rejects.toThrow("Credential file path is outside the Diffgazer credentials directory");
  });
});
