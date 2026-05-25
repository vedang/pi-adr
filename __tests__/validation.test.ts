import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateAdrDirectory } from "../skills/adr/scripts/lib/validation";

const TEST_DATE = "2026-05-25";
const tempRoots: string[] = [];

function makeAdrDirectory(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-validation-"));
  tempRoots.push(root);
  return path.join(root, "doc", "adr");
}

function adrMarkdown(
  number: number,
  title: string,
  options?: {
    readonly date?: string;
    readonly status?: string;
    readonly extraStatus?: string;
    readonly omit?: readonly string[];
  },
): string {
  const omitted = new Set(options?.omit ?? []);
  const statusLines = [options?.status ?? "Accepted", options?.extraStatus]
    .filter(Boolean)
    .join("\n\n");

  return [
    `# ${number}. ${title}`,
    "",
    omitted.has("date") ? undefined : `Date: ${options?.date ?? TEST_DATE}`,
    omitted.has("status") ? undefined : "## Status",
    omitted.has("status") ? undefined : "",
    omitted.has("status") ? undefined : statusLines,
    omitted.has("context") ? undefined : "## Context",
    omitted.has("context") ? undefined : "",
    omitted.has("context") ? undefined : "Existing context.",
    omitted.has("decision") ? undefined : "## Decision",
    omitted.has("decision") ? undefined : "",
    omitted.has("decision") ? undefined : "We will do this.",
    omitted.has("consequences") ? undefined : "## Consequences",
    omitted.has("consequences") ? undefined : "",
    omitted.has("consequences") ? undefined : "Trade-offs are known.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
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

describe("ADR validation", () => {
  it("accepts a well-formed ADR directory", () => {
    const directory = makeAdrDirectory();
    writeAdr(
      directory,
      "0001-record-decisions.md",
      adrMarkdown(1, "Record decisions"),
    );
    writeAdr(
      directory,
      "0002-use-postgresql.md",
      adrMarkdown(2, "Use PostgreSQL", {
        extraStatus:
          "Supersedes [1. Record decisions](0001-record-decisions.md)",
      }),
    );
    writeAdr(
      directory,
      "0003-replace-postgresql.md",
      adrMarkdown(3, "Replace PostgreSQL", {
        status: "Superceded by [4. Use CockroachDB](0004-use-cockroachdb.md)",
      }),
    );
    writeAdr(
      directory,
      "0004-use-cockroachdb.md",
      adrMarkdown(4, "Use CockroachDB", {
        extraStatus:
          "Supercedes [3. Replace PostgreSQL](0003-replace-postgresql.md)",
      }),
    );

    expect(validateAdrDirectory(directory)).toEqual([]);
  });

  it("reports duplicate numbers and number mismatches", () => {
    const directory = makeAdrDirectory();
    writeAdr(directory, "0001-first.md", adrMarkdown(1, "First"));
    writeAdr(directory, "0001-second.md", adrMarkdown(2, "Second"));

    expect(validateAdrDirectory(directory)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: path.join(directory, "0001-second.md"),
          line: 1,
          message: "ADR heading number 2 does not match filename number 1",
        }),
        expect.objectContaining({
          filePath: path.join(directory, "0001-first.md"),
          message: "Duplicate ADR number 1 also used by 0001-second.md",
        }),
      ]),
    );
  });

  it("reports required section, date, and status issues", () => {
    const directory = makeAdrDirectory();
    writeAdr(
      directory,
      "0001-broken.md",
      adrMarkdown(1, "Broken", {
        date: "25 May 2026",
        status: "Maybe",
        omit: ["decision"],
      }),
    );

    expect(validateAdrDirectory(directory)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: 3,
          message: "ADR date must use ISO format YYYY-MM-DD",
        }),
        expect.objectContaining({
          line: 6,
          message:
            "ADR status must be one of: Proposed, Accepted, Rejected, Deprecated, Superseded",
        }),
        expect.objectContaining({
          message: "ADR is missing required section: Decision",
        }),
      ]),
    );
  });

  it("reports broken links in status relationships", () => {
    const directory = makeAdrDirectory();
    writeAdr(
      directory,
      "0001-use-sqlite.md",
      adrMarkdown(1, "Use SQLite", {
        extraStatus:
          "Superseded by [2. Use PostgreSQL](0002-use-postgresql.md)",
      }),
    );

    expect(validateAdrDirectory(directory)).toEqual([
      expect.objectContaining({
        filePath: path.join(directory, "0001-use-sqlite.md"),
        line: 8,
        message:
          "ADR status link target does not exist: 0002-use-postgresql.md",
      }),
    ]);
  });
});
