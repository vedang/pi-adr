import { describe, expect, it } from "vitest";
import {
  ADR_LINK_RELATIONSHIPS,
  ADR_STATUS_VALUES,
  ADR_TEMPLATE_PLACEHOLDERS,
  ADR_TOOLS_COMPAT_LINK_RELATIONSHIPS,
  DEFAULT_ADR_DIRECTORY,
  DEFAULT_ADR_STATUS,
} from "../skills/adr/scripts/lib/model";
import type {
  AdrLink,
  AdrLinkDirection,
  AdrLinkRelationship,
  AdrRecord,
  AdrRepositoryConfig,
  AdrTemplateValues,
} from "../skills/adr/scripts/lib/model";

describe("ADR model", () => {
  it("defines default adr-tools-compatible repository conventions", () => {
    expect(DEFAULT_ADR_DIRECTORY).toBe("doc/adr");
    expect(DEFAULT_ADR_STATUS).toBe("Accepted");
    expect(ADR_STATUS_VALUES).toEqual([
      "Proposed",
      "Accepted",
      "Rejected",
      "Deprecated",
      "Superseded",
    ]);
  });

  it("keeps standard and adr-tools supersede spellings explicit", () => {
    const relationship: AdrLinkRelationship = "supersedes";
    const direction: AdrLinkDirection = "forward";

    expect(relationship).toBe("supersedes");
    expect(direction).toBe("forward");
    expect(ADR_LINK_RELATIONSHIPS.supersedes).toEqual({
      forward: "Supersedes",
      reverse: "Superseded by",
    });
    expect(ADR_TOOLS_COMPAT_LINK_RELATIONSHIPS.supercedes).toEqual({
      forward: "Supercedes",
      reverse: "Superceded by",
    });
  });

  it("models parsed ADRs without losing raw status or content", () => {
    const link: AdrLink = {
      relationship: "Superseded by",
      targetHref: "0002-use-postgresql.md",
      targetNumber: 2,
      targetTitle: "Use PostgreSQL",
      rawMarkdown: "Superseded by [2. Use PostgreSQL](0002-use-postgresql.md)",
    };
    const record: AdrRecord = {
      number: 1,
      title: "Record architecture decisions",
      filename: "0001-record-architecture-decisions.md",
      filePath: "/repo/doc/adr/0001-record-architecture-decisions.md",
      date: "2026-05-25",
      status: null,
      statusText: link.rawMarkdown,
      links: [link],
      rawContent:
        "# 1. Record architecture decisions\n\n## Status\n\nSuperseded by [2. Use PostgreSQL](0002-use-postgresql.md)\n",
    };
    const config: AdrRepositoryConfig = {
      cwd: "/repo",
      directory: "/repo/doc/adr",
      defaultStatus: "Accepted",
    };
    const templateValues: AdrTemplateValues = {
      NUMBER: "1",
      TITLE: "Record architecture decisions",
      DATE: "2026-05-25",
      STATUS: "Accepted",
    };

    expect(record.status).toBeNull();
    expect(record.statusText).toContain("Superseded by");
    expect(record.links).toEqual([link]);
    expect(config.directory.endsWith(DEFAULT_ADR_DIRECTORY)).toBe(true);
    expect(Object.keys(templateValues)).toEqual([...ADR_TEMPLATE_PLACEHOLDERS]);
  });
});
