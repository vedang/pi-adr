import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAdrScript } from "../skills/adr/scripts/adr";

const TEST_DATE = "2026-05-25";
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-script-"));
  tempRoots.push(root);
  return root;
}

function runScript(
  cwd: string,
  argv: readonly string[],
): {
  readonly code: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = runAdrScript([...argv], {
    cwd,
    date: TEST_DATE,
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  });

  return { code, stdout, stderr };
}

function defaultAdrDirectory(root: string): string {
  return path.join(root, "doc", "adr");
}

function defaultAdrPath(root: string, filename: string): string {
  return path.join(defaultAdrDirectory(root), filename);
}

function readDefaultAdr(root: string, filename: string): string {
  return readFileSync(defaultAdrPath(root, filename), "utf8");
}

function writeAdr(directory: string, filename: string, markdown: string): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, filename), `${markdown}\n`);
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ADR script", () => {
  it("keeps slug and filename helpers available", () => {
    const root = makeTempRoot();

    expect(runScript(root, ["slug", "Something About Node.JS"])).toEqual({
      code: 0,
      stdout: ["something-about-node-js"],
      stderr: [],
    });
    expect(runScript(root, ["filename", "7", "Use PostgreSQL"])).toEqual({
      code: 0,
      stdout: ["0007-use-postgresql.md"],
      stderr: [],
    });
  });

  it("initializes an ADR directory with the initial record", () => {
    const root = makeTempRoot();
    const result = runScript(root, ["init", "decisions"]);
    const adrPath = path.join(
      root,
      "decisions",
      "0001-record-architecture-decisions.md",
    );

    expect(result).toEqual({ code: 0, stdout: [adrPath], stderr: [] });
    expect(readFileSync(path.join(root, ".adr-dir"), "utf8")).toBe(
      "decisions\n",
    );
    expect(readFileSync(adrPath, "utf8")).toContain(`Date: ${TEST_DATE}`);
    expect(readFileSync(adrPath, "utf8")).toContain(
      "We will record architecture decisions as numbered Markdown files",
    );
  });

  it("creates new ADRs and supersedes existing records", () => {
    const root = makeTempRoot();
    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });

    const result = runScript(root, [
      "new",
      "--status",
      "Proposed",
      "--supersedes",
      "1",
      "Use PostgreSQL",
    ]);
    const createdPath = defaultAdrPath(root, "0002-use-postgresql.md");

    expect(result).toEqual({ code: 0, stdout: [createdPath], stderr: [] });
    expect(readDefaultAdr(root, "0002-use-postgresql.md")).toContain(
      "Proposed\n\nSupersedes [1. Record architecture decisions](0001-record-architecture-decisions.md)",
    );
    expect(
      readDefaultAdr(root, "0001-record-architecture-decisions.md"),
    ).toContain("Superseded by [2. Use PostgreSQL](0002-use-postgresql.md)");
    expect(runScript(root, ["validate"])).toEqual({
      code: 0,
      stdout: [`ADR validation passed: ${defaultAdrDirectory(root)}`],
      stderr: [],
    });
  });

  it("links records and lists them", () => {
    const root = makeTempRoot();
    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
    expect(runScript(root, ["new", "Use PostgreSQL"])).toMatchObject({
      code: 0,
    });

    const linkResult = runScript(root, [
      "link",
      "2",
      "Clarifies",
      "1",
      "Clarified by",
    ]);
    const listResult = runScript(root, ["list"]);

    expect(linkResult).toEqual({
      code: 0,
      stdout: [
        "0002-use-postgresql.md Clarifies 0001-record-architecture-decisions.md",
      ],
      stderr: [],
    });
    expect(listResult).toEqual({
      code: 0,
      stdout: [
        "1\tAccepted\t0001-record-architecture-decisions.md\tRecord architecture decisions",
        "2\tAccepted\t0002-use-postgresql.md\tUse PostgreSQL",
      ],
      stderr: [],
    });
  });

  it("generates TOC and graph reports", () => {
    const root = makeTempRoot();
    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
    expect(runScript(root, ["new", "Use PostgreSQL"])).toMatchObject({
      code: 0,
    });

    expect(runScript(root, ["toc", "--prefix", "adr/"])).toMatchObject({
      code: 0,
      stdout: [
        "# Architecture Decision Records\n\n* [Record architecture decisions](adr/0001-record-architecture-decisions.md)\n* [Use PostgreSQL](adr/0002-use-postgresql.md)\n",
      ],
      stderr: [],
    });
    expect(
      runScript(root, ["graph", "--prefix", "adr/", "--extension", ".svg"]),
    ).toMatchObject({
      code: 0,
      stdout: [
        expect.stringContaining(
          '1 [label="1. Record architecture decisions", URL="adr/0001-record-architecture-decisions.svg"]',
        ),
      ],
      stderr: [],
    });
  });

  it("rejects stray arguments for read-only commands", () => {
    const root = makeTempRoot();
    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });

    expect(runScript(root, ["list", "--verbose"])).toMatchObject({
      code: 1,
      stdout: [],
      stderr: [expect.stringContaining("list does not accept arguments")],
    });
    expect(runScript(root, ["toc", "--extension", ".svg"])).toMatchObject({
      code: 1,
      stdout: [],
      stderr: [expect.stringContaining("Unknown TOC option: --extension")],
    });
  });

  it("validates ADR directories with line-aware errors", () => {
    const root = makeTempRoot();
    const adrDirectory = defaultAdrDirectory(root);
    const brokenPath = defaultAdrPath(root, "0001-broken.md");
    writeAdr(
      adrDirectory,
      "0001-broken.md",
      `# 1. Broken

Date: May 25, 2026

## Status

Maybe

## Context

Known context.

## Decision

We will do this.

## Consequences

Known trade-offs.`,
    );

    expect(runScript(root, ["validate"])).toEqual({
      code: 1,
      stdout: [],
      stderr: [
        `${brokenPath}:3: ADR date must use ISO format YYYY-MM-DD`,
        `${brokenPath}:7: ADR status must be one of: Proposed, Accepted, Rejected, Deprecated, Superseded`,
      ],
    });
  });
});
