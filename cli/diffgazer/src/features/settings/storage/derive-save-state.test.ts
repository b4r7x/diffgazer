import { test, describe, expect } from "vitest";
import { deriveStorageSaveState } from "./derive-save-state.js";

describe("deriveStorageSaveState", () => {
  test("falls back to 'file' when nothing is persisted or chosen", () => {
    const result = deriveStorageSaveState({
      persisted: null,
      choice: null,
      saving: false,
    });
    expect(result.effective).toBe("file");
    expect(result.isDirty).toBe(true);
    expect(result.canSave).toBe(true);
  });

  test("uses persisted value when no choice yet, and is not dirty", () => {
    const result = deriveStorageSaveState({
      persisted: "keyring",
      choice: null,
      saving: false,
    });
    expect(result.effective).toBe("keyring");
    expect(result.isDirty).toBe(false);
    expect(result.canSave).toBe(false);
  });

  test("becomes dirty after switching backend", () => {
    const result = deriveStorageSaveState({
      persisted: "file",
      choice: "keyring",
      saving: false,
    });
    expect(result.effective).toBe("keyring");
    expect(result.isDirty).toBe(true);
    expect(result.canSave).toBe(true);
  });

  test("blocks save while saving even when dirty", () => {
    const result = deriveStorageSaveState({
      persisted: "file",
      choice: "keyring",
      saving: true,
    });
    expect(result.isDirty).toBe(true);
    expect(result.canSave).toBe(false);
  });

  test("blocks save when choice equals persisted", () => {
    const result = deriveStorageSaveState({
      persisted: "file",
      choice: "file",
      saving: false,
    });
    expect(result.isDirty).toBe(false);
    expect(result.canSave).toBe(false);
  });

  test("blocks save while saving even when nothing is dirty", () => {
    const result = deriveStorageSaveState({
      persisted: "file",
      choice: null,
      saving: true,
    });
    expect(result.isDirty).toBe(false);
    expect(result.canSave).toBe(false);
  });
});
