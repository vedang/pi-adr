import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runAdrScript } from "../../skills/adr/scripts/adr";

const TEST_DATE = "2026-05-25";
const INITIAL_ADR_FILENAME = "0001-record-architecture-decisions.md";
const EXPECTED_INITIAL_ADR = `# 1. Record architecture decisions

Date: ${TEST_DATE}

## Status

Accepted

## Context

The project needs a lightweight way to preserve important architecture decisions and the forces that shaped them.

## Decision

We will record architecture decisions as numbered Markdown files in version control.

## Consequences

Future maintainers can understand why decisions were made. The project gains a small documentation maintenance obligation. Superseded decisions remain available as historical context.
`;
const NEW_ADR_CASES = [
  {
    number: 2,
    title: "Use PostgreSQL",
    filename: "0002-use-postgresql.md",
  },
  {
    number: 3,
    title: "Use Redis for cache",
    filename: "0003-use-redis-for-cache.md",
  },
] as const;
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-workflow-"));
  tempRoots.push(root);
  return root;
}

function adrPath(root: string, filename: string): string {
  return path.join(root, "doc", "adr", filename);
}

function initialAdrPath(root: string): string {
  return adrPath(root, INITIAL_ADR_FILENAME);
}

function expectedDefaultAdr(number: number, title: string): string {
  return `# ${number}. ${title}

Date: ${TEST_DATE}

## Status

Accepted

## Context

## Decision

## Consequences
`;
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

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ADR workflows", () => {
  it("creates the first record", () => {
    const root = makeTempRoot();
    const adrPath = initialAdrPath(root);

    expect(runScript(root, ["init"])).toEqual({
      code: 0,
      stdout: [adrPath],
      stderr: [],
    });
    expect(existsSync(path.join(root, ".adr-dir"))).toBe(false);
    expect(readFileSync(adrPath, "utf8")).toBe(EXPECTED_INITIAL_ADR);
  });

  it("creates multiple records with monotonic numbering", () => {
    const root = makeTempRoot();

    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
    for (const { number, title, filename } of NEW_ADR_CASES) {
      const filePath = adrPath(root, filename);

      expect(runScript(root, ["new", title])).toEqual({
        code: 0,
        stdout: [filePath],
        stderr: [],
      });
      expect(readFileSync(filePath, "utf8")).toBe(
        expectedDefaultAdr(number, title),
      );
    }

    expect(runScript(root, ["list"])).toEqual({
      code: 0,
      stdout: [
        "1\tAccepted\t0001-record-architecture-decisions.md\tRecord architecture decisions",
        ...NEW_ADR_CASES.map(({ number, filename, title }) =>
          [number, "Accepted", filename, title].join("\t"),
        ),
      ],
      stderr: [],
    });
  });
});
