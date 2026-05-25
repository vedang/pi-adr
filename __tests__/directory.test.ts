import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverAdrRepositoryConfig } from "../skills/adr/scripts/lib/directory";
import {
  DEFAULT_ADR_DIRECTORY,
  DEFAULT_ADR_STATUS,
} from "../skills/adr/scripts/lib/model";

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-directory-"));
  tempRoots.push(root);
  return root;
}

function expectDiscoveredDirectory(cwd: string, directory: string): void {
  expect(discoverAdrRepositoryConfig(cwd).directory).toBe(directory);
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ADR directory discovery", () => {
  it("uses the closest .adr-dir marker when walking upward", () => {
    const root = makeTempRoot();
    const cwd = path.join(root, "service", "src", "feature");
    mkdirSync(path.join(root, DEFAULT_ADR_DIRECTORY), { recursive: true });
    mkdirSync(cwd, { recursive: true });
    writeFileSync(path.join(root, "service", ".adr-dir"), "decisions\n");

    expect(discoverAdrRepositoryConfig(cwd)).toEqual({
      cwd,
      directory: path.join(root, "service", "decisions"),
      configFilePath: path.join(root, "service", ".adr-dir"),
      defaultStatus: DEFAULT_ADR_STATUS,
    });
  });

  it("prefers .adr-dir over doc/adr in the same directory", () => {
    const root = makeTempRoot();
    const cwd = path.join(root, "src");
    mkdirSync(path.join(root, DEFAULT_ADR_DIRECTORY), { recursive: true });
    mkdirSync(cwd, { recursive: true });
    writeFileSync(path.join(root, ".adr-dir"), "architecture/decisions\n");

    expectDiscoveredDirectory(
      cwd,
      path.join(root, "architecture", "decisions"),
    );
  });

  it("uses the nearest doc/adr directory when no .adr-dir marker exists", () => {
    const root = makeTempRoot();
    const cwd = path.join(root, "service", "src");
    const nearestAdrDirectory = path.join(
      root,
      "service",
      DEFAULT_ADR_DIRECTORY,
    );
    mkdirSync(path.join(root, DEFAULT_ADR_DIRECTORY), { recursive: true });
    mkdirSync(nearestAdrDirectory, { recursive: true });
    mkdirSync(cwd, { recursive: true });

    expectDiscoveredDirectory(cwd, nearestAdrDirectory);
  });

  it("stops at a nearer doc/adr before a farther .adr-dir marker", () => {
    const root = makeTempRoot();
    const cwd = path.join(root, "service", "src");
    const nearestAdrDirectory = path.join(
      root,
      "service",
      DEFAULT_ADR_DIRECTORY,
    );
    mkdirSync(nearestAdrDirectory, { recursive: true });
    mkdirSync(cwd, { recursive: true });
    writeFileSync(path.join(root, ".adr-dir"), "root-decisions\n");

    expectDiscoveredDirectory(cwd, nearestAdrDirectory);
  });

  it("defaults to repo root doc/adr when no ADR markers exist", () => {
    const root = makeTempRoot();
    const cwd = path.join(root, "packages", "app", "src");
    mkdirSync(path.join(root, ".git"), { recursive: true });
    mkdirSync(cwd, { recursive: true });

    expectDiscoveredDirectory(cwd, path.join(root, DEFAULT_ADR_DIRECTORY));
  });

  it("defaults to the start cwd doc/adr outside a repository", () => {
    const root = makeTempRoot();
    const cwd = path.join(root, "workspace", "src");
    mkdirSync(cwd, { recursive: true });

    expectDiscoveredDirectory(cwd, path.join(cwd, DEFAULT_ADR_DIRECTORY));
  });

  it("rejects empty .adr-dir files", () => {
    const root = makeTempRoot();
    const cwd = path.join(root, "src");
    mkdirSync(cwd, { recursive: true });
    writeFileSync(path.join(root, ".adr-dir"), "\n");

    expect(() => discoverAdrRepositoryConfig(cwd)).toThrow(
      ".adr-dir must contain an ADR directory path",
    );
  });
});
