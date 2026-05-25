import { describe, expect, it } from "vitest";
import {
  extractAdrStatusBlock,
  parseAdrFilename,
  parseAdrMarkdown,
} from "../skills/adr/scripts/lib/parser";

const ADR_CONTENT = `# 12. Use PostgreSQL

Date: 2026-05-25

## Status

Accepted

Supersedes [3. Use SQLite](0003-use-sqlite.md)
Superceded by [14. Use CockroachDB](0014-use-cockroachdb.md)
Clarifies [7. Persistence rules](0007-persistence-rules.md)

## Context

We need transactional storage.

## Decision

We will use PostgreSQL.

## Consequences

Operational maturity improves.
`;

describe("ADR markdown parser", () => {
  it("parses adr-tools filenames", () => {
    expect(parseAdrFilename("0001-record-architecture-decisions.md")).toEqual({
      number: 1,
      paddedNumber: "0001",
      slug: "record-architecture-decisions",
    });
    expect(parseAdrFilename("0012-use-postgresql.md")).toEqual({
      number: 12,
      paddedNumber: "0012",
      slug: "use-postgresql",
    });
  });

  it("ignores files outside the ADR filename shape", () => {
    expect(parseAdrFilename("1-record-architecture-decisions.md")).toBeNull();
    expect(parseAdrFilename("0001.md")).toBeNull();
    expect(
      parseAdrFilename("0001-record-architecture-decisions.txt"),
    ).toBeNull();
  });

  it("extracts the status block until the next markdown heading", () => {
    expect(extractAdrStatusBlock(ADR_CONTENT)).toBe(
      "Accepted\n\nSupersedes [3. Use SQLite](0003-use-sqlite.md)\nSuperceded by [14. Use CockroachDB](0014-use-cockroachdb.md)\nClarifies [7. Persistence rules](0007-persistence-rules.md)",
    );
  });

  it("parses record metadata, status links, and raw content", () => {
    expect(
      parseAdrMarkdown("/repo/doc/adr/0012-use-postgresql.md", ADR_CONTENT),
    ).toEqual({
      number: 12,
      title: "Use PostgreSQL",
      filename: "0012-use-postgresql.md",
      filePath: "/repo/doc/adr/0012-use-postgresql.md",
      date: "2026-05-25",
      status: "Accepted",
      statusText:
        "Accepted\n\nSupersedes [3. Use SQLite](0003-use-sqlite.md)\nSuperceded by [14. Use CockroachDB](0014-use-cockroachdb.md)\nClarifies [7. Persistence rules](0007-persistence-rules.md)",
      links: [
        {
          relationship: "Supersedes",
          targetHref: "0003-use-sqlite.md",
          targetNumber: 3,
          targetTitle: "Use SQLite",
          rawMarkdown: "[3. Use SQLite](0003-use-sqlite.md)",
        },
        {
          relationship: "Superceded by",
          targetHref: "0014-use-cockroachdb.md",
          targetNumber: 14,
          targetTitle: "Use CockroachDB",
          rawMarkdown: "[14. Use CockroachDB](0014-use-cockroachdb.md)",
        },
        {
          relationship: "Clarifies",
          targetHref: "0007-persistence-rules.md",
          targetNumber: 7,
          targetTitle: "Persistence rules",
          rawMarkdown: "[7. Persistence rules](0007-persistence-rules.md)",
        },
      ],
      rawContent: ADR_CONTENT,
    });
  });

  it("keeps unknown statuses and missing dates nullable", () => {
    const content =
      "# 2. Try queues\n\n## Status\n\nConsidering\n\n## Context\n\nNeed async work.\n";

    expect(
      parseAdrMarkdown("/repo/doc/adr/0002-try-queues.md", content),
    ).toMatchObject({
      date: null,
      status: null,
      statusText: "Considering",
      links: [],
    });
  });
});
