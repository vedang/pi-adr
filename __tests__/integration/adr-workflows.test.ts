import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runAdrScript } from "../../skills/adr/scripts/adr";

const TEST_DATE = "2026-05-25";
const INITIAL_ADR_FILENAME = "0001-record-architecture-decisions.md";
const POSTGRES_ADR_FILENAME = "0002-use-postgresql.md";
const REDIS_ADR_FILENAME = "0003-use-redis-for-cache.md";
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
const EXPECTED_POSTGRES_ADR = `# 2. Use PostgreSQL

Date: ${TEST_DATE}

## Status

Accepted

## Context

## Decision

## Consequences
`;
const EXPECTED_REDIS_ADR = `# 3. Use Redis for cache

Date: ${TEST_DATE}

## Status

Accepted

## Context

## Decision

## Consequences
`;
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
    const postgresPath = adrPath(root, POSTGRES_ADR_FILENAME);
    const redisPath = adrPath(root, REDIS_ADR_FILENAME);

    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
    expect(runScript(root, ["new", "Use PostgreSQL"])).toEqual({
      code: 0,
      stdout: [postgresPath],
      stderr: [],
    });
    expect(runScript(root, ["new", "Use Redis for cache"])).toEqual({
      code: 0,
      stdout: [redisPath],
      stderr: [],
    });

    expect(readFileSync(postgresPath, "utf8")).toBe(EXPECTED_POSTGRES_ADR);
    expect(readFileSync(redisPath, "utf8")).toBe(EXPECTED_REDIS_ADR);
    expect(runScript(root, ["list"])).toEqual({
      code: 0,
      stdout: [
        "1\tAccepted\t0001-record-architecture-decisions.md\tRecord architecture decisions",
        "2\tAccepted\t0002-use-postgresql.md\tUse PostgreSQL",
        "3\tAccepted\t0003-use-redis-for-cache.md\tUse Redis for cache",
      ],
      stderr: [],
    });
  });
});
