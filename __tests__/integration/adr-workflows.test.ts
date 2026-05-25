import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runAdrScript } from "../../skills/adr/scripts/adr";

const TEST_DATE = "2026-05-25";
const INITIAL_ADR_FILENAME = "0001-record-architecture-decisions.md";
const INITIAL_ADR_LIST_ROW =
  "1\tAccepted\t0001-record-architecture-decisions.md\tRecord architecture decisions";
const ALTERNATIVE_ADR_DIRECTORY = "architecture/decisions";
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
interface DefaultAdrCase {
  readonly number: number;
  readonly title: string;
  readonly filename: string;
}

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
const FUNNY_TITLE_CASES = [
  {
    number: 2,
    title: "Something About Node.JS",
    filename: "0002-something-about-node-js.md",
  },
  {
    number: 3,
    title: "Slash/Slash/Slash/",
    filename: "0003-slash-slash-slash.md",
  },
  {
    number: 4,
    title: '"-Bar-"',
    filename: "0004-bar.md",
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

function expectedListRows(cases: readonly DefaultAdrCase[]): string[] {
  return [
    INITIAL_ADR_LIST_ROW,
    ...cases.map(({ number, filename, title }) =>
      [number, "Accepted", filename, title].join("\t"),
    ),
  ];
}

function expectDefaultAdrCreation(
  root: string,
  cases: readonly DefaultAdrCase[],
): void {
  for (const { number, title, filename } of cases) {
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
}

function expectDefaultAdrWorkflow(cases: readonly DefaultAdrCase[]): void {
  const root = makeTempRoot();

  expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
  expectDefaultAdrCreation(root, cases);
  expect(runScript(root, ["list"])).toEqual({
    code: 0,
    stdout: expectedListRows(cases),
    stderr: [],
  });
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
    expectDefaultAdrWorkflow(NEW_ADR_CASES);
  });

  it("creates records in an alternative ADR directory", () => {
    const root = makeTempRoot();
    const initialPath = path.join(
      root,
      ALTERNATIVE_ADR_DIRECTORY,
      INITIAL_ADR_FILENAME,
    );
    const createdPath = path.join(
      root,
      ALTERNATIVE_ADR_DIRECTORY,
      "0002-use-postgresql.md",
    );

    expect(runScript(root, ["init", ALTERNATIVE_ADR_DIRECTORY])).toEqual({
      code: 0,
      stdout: [initialPath],
      stderr: [],
    });
    expect(readFileSync(path.join(root, ".adr-dir"), "utf8")).toBe(
      `${ALTERNATIVE_ADR_DIRECTORY}\n`,
    );
    expect(existsSync(path.join(root, "doc", "adr"))).toBe(false);
    expect(readFileSync(initialPath, "utf8")).toBe(EXPECTED_INITIAL_ADR);

    expect(runScript(root, ["new", "Use PostgreSQL"])).toEqual({
      code: 0,
      stdout: [createdPath],
      stderr: [],
    });
    expect(readFileSync(createdPath, "utf8")).toBe(
      expectedDefaultAdr(2, "Use PostgreSQL"),
    );
    expect(runScript(root, ["list"])).toEqual({
      code: 0,
      stdout: [
        INITIAL_ADR_LIST_ROW,
        "2\tAccepted\t0002-use-postgresql.md\tUse PostgreSQL",
      ],
      stderr: [],
    });
  });

  it("slugifies funny title characters during record creation", () => {
    expectDefaultAdrWorkflow(FUNNY_TITLE_CASES);
  });
});
