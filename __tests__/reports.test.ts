import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AdrLink, AdrRecord } from "../skills/adr/scripts/lib/model";
import {
  generateAdrGraph,
  generateAdrToc,
} from "../skills/adr/scripts/lib/reports";

function adrRecord(
  number: number,
  title: string,
  filename: string,
  links: readonly AdrLink[] = [],
): AdrRecord {
  return {
    number,
    title,
    filename,
    filePath: path.join("doc", "adr", filename),
    date: "2026-05-25",
    status: "Accepted",
    statusText: "Accepted",
    links,
    rawContent: "",
  };
}

function adrLink(relationship: string, targetNumber: number): AdrLink {
  return {
    relationship,
    targetHref: `000${targetNumber}-target.md`,
    targetNumber,
    rawMarkdown: "",
  };
}

describe("ADR reports", () => {
  it("generates a Markdown table of contents", () => {
    const records = [
      adrRecord(
        1,
        "Record architecture decisions",
        "0001-record-architecture-decisions.md",
      ),
      adrRecord(2, "Use PostgreSQL", "0002-use-postgresql.md"),
    ];

    expect(generateAdrToc(records)).toBe(`# Architecture Decision Records

* [Record architecture decisions](0001-record-architecture-decisions.md)
* [Use PostgreSQL](0002-use-postgresql.md)
`);
  });

  it("supports a link prefix in the Markdown table of contents", () => {
    const records = [
      adrRecord(1, "Record decisions", "0001-record-decisions.md"),
    ];

    expect(
      generateAdrToc(records, { linkPrefix: "docs/adr/" }),
    ).toBe(`# Architecture Decision Records

* [Record decisions](docs/adr/0001-record-decisions.md)
`);
  });

  it("generates Graphviz DOT with sequential and relationship edges", () => {
    const records = [
      adrRecord(1, "Record decisions", "0001-record-decisions.md"),
      adrRecord(2, "Use PostgreSQL", "0002-use-postgresql.md", [
        adrLink("Supersedes", 1),
      ]),
      adrRecord(3, "Use read replicas", "0003-use-read-replicas.md", [
        adrLink("Clarifies", 2),
        adrLink("Clarified by", 4),
      ]),
    ];

    expect(generateAdrGraph(records)).toBe(`digraph {
  node [shape=plaintext];
  1 [label="1. Record decisions", URL="0001-record-decisions.html"];
  2 [label="2. Use PostgreSQL", URL="0002-use-postgresql.html"];
  3 [label="3. Use read replicas", URL="0003-use-read-replicas.html"];
  1 -> 2 [style=dotted, weight=1];
  2 -> 3 [style=dotted, weight=1];
  2 -> 1 [label="Supersedes", weight=0];
  3 -> 2 [label="Clarifies", weight=0];
}
`);
  });

  it("supports link prefix and extension in Graphviz DOT URLs", () => {
    const records = [
      adrRecord(1, "Record decisions", "0001-record-decisions.md"),
    ];

    expect(
      generateAdrGraph(records, {
        linkPrefix: "/adr/",
        linkExtension: ".md",
      }),
    ).toBe(`digraph {
  node [shape=plaintext];
  1 [label="1. Record decisions", URL="/adr/0001-record-decisions.md"];
}
`);
  });
});
