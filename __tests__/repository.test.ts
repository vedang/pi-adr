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
import {
  type AdrRepositoryConfig,
  DEFAULT_ADR_STATUS,
} from "../skills/adr/scripts/lib/model";
import {
  createAdrRecord,
  getNextAdrNumber,
  listAdrRecords,
} from "../skills/adr/scripts/lib/repository";

const TEST_DATE = "2026-05-25";
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-repository-"));
  tempRoots.push(root);
  return root;
}

function makeAdrDirectory(): string {
  return path.join(makeTempRoot(), "doc", "adr");
}

function repositoryConfig(directory: string): AdrRepositoryConfig {
  return {
    cwd: path.dirname(directory),
    directory,
    defaultStatus: DEFAULT_ADR_STATUS,
  };
}

function adrMarkdown(number: number, title: string): string {
  return `# ${number}. ${title}

Date: ${TEST_DATE}

## Status

Accepted

## Context

Existing context.
`;
}

function writeAdrFixture(
  directory: string,
  filename: string,
  number: number,
  title: string,
): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, filename), adrMarkdown(number, title));
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ADR repository", () => {
  it("lists ADR records sorted by number and ignores unrelated files", () => {
    const directory = makeAdrDirectory();
    writeAdrFixture(directory, "0002-use-postgresql.md", 2, "Use PostgreSQL");
    writeAdrFixture(
      directory,
      "0001-record-architecture-decisions.md",
      1,
      "Record architecture decisions",
    );
    writeFileSync(path.join(directory, "README.md"), "# ADR notes\n");

    expect(
      listAdrRecords(directory).map(({ number, title, filename }) => ({
        number,
        title,
        filename,
      })),
    ).toEqual([
      {
        number: 1,
        title: "Record architecture decisions",
        filename: "0001-record-architecture-decisions.md",
      },
      {
        number: 2,
        title: "Use PostgreSQL",
        filename: "0002-use-postgresql.md",
      },
    ]);
  });

  it("computes the next monotonic ADR number from existing records", () => {
    const directory = makeAdrDirectory();
    writeAdrFixture(
      directory,
      "0001-record-decisions.md",
      1,
      "Record decisions",
    );
    writeAdrFixture(directory, "0003-use-postgresql.md", 3, "Use PostgreSQL");

    expect(getNextAdrNumber([])).toBe(1);
    expect(getNextAdrNumber(listAdrRecords(directory))).toBe(4);
  });

  it("creates a new ADR file from the next number and default template", () => {
    const directory = makeAdrDirectory();

    const record = createAdrRecord({
      config: repositoryConfig(directory),
      title: "Use PostgreSQL",
      date: TEST_DATE,
    });

    expect(record).toMatchObject({
      number: 1,
      title: "Use PostgreSQL",
      filename: "0001-use-postgresql.md",
      filePath: path.join(directory, "0001-use-postgresql.md"),
      date: TEST_DATE,
      status: "Accepted",
    });
    expect(readFileSync(record.filePath, "utf8")).toBe(`# 1. Use PostgreSQL

Date: ${TEST_DATE}

## Status

Accepted

## Context

## Decision

## Consequences
`);
  });

  it("rejects duplicate ADR numbers", () => {
    const directory = makeAdrDirectory();
    writeAdrFixture(
      directory,
      "0001-record-decisions.md",
      1,
      "Record decisions",
    );
    writeAdrFixture(directory, "0001-use-postgresql.md", 1, "Use PostgreSQL");

    expect(() => listAdrRecords(directory)).toThrow("Duplicate ADR number 1");
  });

  it("refuses to overwrite a conflicting generated filename", () => {
    const directory = makeAdrDirectory();
    writeAdrFixture(directory, "0001-use-postgresql.md", 1, "Use PostgreSQL");

    expect(() =>
      createAdrRecord({
        config: repositoryConfig(directory),
        title: "Use PostgreSQL",
        date: TEST_DATE,
        number: 1,
      }),
    ).toThrow("ADR file already exists");
  });
});
