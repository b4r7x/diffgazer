import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { deriveStorageSaveState } from "./derive-save-state.js";

describe("deriveStorageSaveState", () => {
  test("falls back to 'file' when nothing is persisted or chosen", () => {
    const result = deriveStorageSaveState({
      persisted: null,
      choice: null,
      saving: false,
    });
    assert.equal(result.effective, "file");
    assert.equal(result.isDirty, true);
    assert.equal(result.canSave, true);
  });

  test("uses persisted value when no choice yet, and is not dirty", () => {
    const result = deriveStorageSaveState({
      persisted: "keyring",
      choice: null,
      saving: false,
    });
    assert.equal(result.effective, "keyring");
    assert.equal(result.isDirty, false);
    assert.equal(result.canSave, false);
  });

  test("becomes dirty after switching backend", () => {
    const result = deriveStorageSaveState({
      persisted: "file",
      choice: "keyring",
      saving: false,
    });
    assert.equal(result.effective, "keyring");
    assert.equal(result.isDirty, true);
    assert.equal(result.canSave, true);
  });

  test("blocks save while saving even when dirty", () => {
    const result = deriveStorageSaveState({
      persisted: "file",
      choice: "keyring",
      saving: true,
    });
    assert.equal(result.isDirty, true);
    assert.equal(result.canSave, false);
  });

  test("blocks save when choice equals persisted", () => {
    const result = deriveStorageSaveState({
      persisted: "file",
      choice: "file",
      saving: false,
    });
    assert.equal(result.isDirty, false);
    assert.equal(result.canSave, false);
  });

  test("blocks save while saving even when nothing is dirty", () => {
    const result = deriveStorageSaveState({
      persisted: "file",
      choice: null,
      saving: true,
    });
    assert.equal(result.isDirty, false);
    assert.equal(result.canSave, false);
  });
});
