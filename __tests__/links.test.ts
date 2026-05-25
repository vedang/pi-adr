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
  isSupersededByRelationship,
  isSupersedesRelationship,
  linkAdrRecords,
  resolveAdrReference,
  supersedeAdrRecords,
} from "../skills/adr/scripts/lib/links";
import { listAdrRecords } from "../skills/adr/scripts/lib/repository";

const TEST_DATE = "2026-05-25";
const tempRoots: string[] = [];

function makeAdrDirectory(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-links-"));
  tempRoots.push(root);
  return path.join(root, "doc", "adr");
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

describe("ADR links", () => {
  it("resolves ADR refs by number, padded number, filename, and unique substring", () => {
    const directory = makeAdrDirectory();
    writeAdrFixture(
      directory,
      "0001-record-decisions.md",
      1,
      "Record decisions",
    );
    writeAdrFixture(directory, "0002-use-postgresql.md", 2, "Use PostgreSQL");
    writeAdrFixture(directory, "0003-use-redis.md", 3, "Use Redis");
    const records = listAdrRecords(directory);

    expect(resolveAdrReference(records, "2").filename).toBe(
      "0002-use-postgresql.md",
    );
    expect(resolveAdrReference(records, "0002").filename).toBe(
      "0002-use-postgresql.md",
    );
    expect(
      resolveAdrReference(records, "0002-use-postgresql.md").filename,
    ).toBe("0002-use-postgresql.md");
    expect(resolveAdrReference(records, "redis").filename).toBe(
      "0003-use-redis.md",
    );
    expect(() => resolveAdrReference(records, "use")).toThrow(
      "Ambiguous ADR reference",
    );
    expect(() => resolveAdrReference(records, "missing")).toThrow(
      "No ADR matches reference",
    );
  });

  it("adds bidirectional status links between ADRs", () => {
    const directory = makeAdrDirectory();
    writeAdrFixture(directory, "0001-use-queues.md", 1, "Use queues");
    writeAdrFixture(directory, "0002-use-outbox.md", 2, "Use outbox");
    const [source, target] = listAdrRecords(directory);

    linkAdrRecords({
      source,
      relationship: "Amends",
      target,
      reverseRelationship: "Amended by",
    });

    const [updatedSource, updatedTarget] = listAdrRecords(directory);
    expect(updatedSource.statusText).toBe(
      "Accepted\n\nAmends [2. Use outbox](0002-use-outbox.md)",
    );
    expect(updatedTarget.statusText).toBe(
      "Accepted\n\nAmended by [1. Use queues](0001-use-queues.md)",
    );
  });

  it("supersedes old ADRs with standard spelling", () => {
    const directory = makeAdrDirectory();
    writeAdrFixture(directory, "0001-use-sqlite.md", 1, "Use SQLite");
    writeAdrFixture(directory, "0002-use-postgresql.md", 2, "Use PostgreSQL");
    const [oldRecord, newRecord] = listAdrRecords(directory);

    supersedeAdrRecords({
      supersedingRecord: newRecord,
      supersededRecords: [oldRecord],
    });

    const [updatedOld, updatedNew] = listAdrRecords(directory);
    expect(updatedOld.statusText).toBe(
      "Superseded by [2. Use PostgreSQL](0002-use-postgresql.md)",
    );
    expect(updatedNew.statusText).toBe(
      "Accepted\n\nSupersedes [1. Use SQLite](0001-use-sqlite.md)",
    );
    expect(readFileSync(updatedOld.filePath, "utf8")).not.toContain(
      "Accepted\n\n## Context",
    );
  });

  it("supports adr-tools supersede misspellings", () => {
    const directory = makeAdrDirectory();
    writeAdrFixture(directory, "0001-use-sqlite.md", 1, "Use SQLite");
    writeAdrFixture(directory, "0002-use-postgresql.md", 2, "Use PostgreSQL");
    const [oldRecord, newRecord] = listAdrRecords(directory);

    supersedeAdrRecords({
      supersedingRecord: newRecord,
      supersededRecords: [oldRecord],
      spelling: "adr-tools",
    });

    const [updatedOld, updatedNew] = listAdrRecords(directory);
    expect(updatedOld.statusText).toBe(
      "Superceded by [2. Use PostgreSQL](0002-use-postgresql.md)",
    );
    expect(updatedNew.statusText).toBe(
      "Accepted\n\nSupercedes [1. Use SQLite](0001-use-sqlite.md)",
    );
    expect(isSupersedesRelationship("Supersedes")).toBe(true);
    expect(isSupersedesRelationship("Supercedes")).toBe(true);
    expect(isSupersededByRelationship("Superseded by")).toBe(true);
    expect(isSupersededByRelationship("Superceded by")).toBe(true);
  });
});
