import { describe, expect, it } from "vitest";
import {
  ADR_LINK_RELATIONSHIPS,
  ADR_STATUS_VALUES,
  ADR_TEMPLATE_PLACEHOLDERS,
  DEFAULT_ADR_DIRECTORY,
  DEFAULT_ADR_STATUS,
} from "../skills/adr/scripts/lib/model";
import type {
  AdrLink,
  AdrRecord,
  AdrRepositoryConfig,
  AdrTemplateValues,
} from "../skills/adr/scripts/lib/model";

describe("ADR model", () => {
  it("defines ADR conventions as runtime constants", () => {
    expect(DEFAULT_ADR_DIRECTORY).toBe("doc/adr");
    expect(DEFAULT_ADR_STATUS).toBe("Accepted");
    expect(ADR_STATUS_VALUES).toEqual([
      "Proposed",
      "Accepted",
      "Rejected",
      "Deprecated",
      "Superseded",
    ]);
    expect(ADR_LINK_RELATIONSHIPS).toMatchObject({
      supersedes: {
        forward: "Supersedes",
        reverse: "Superseded by",
      },
      supercedes: {
        forward: "Supercedes",
        reverse: "Superceded by",
      },
    });
    expect(ADR_TEMPLATE_PLACEHOLDERS).toEqual([
      "NUMBER",
      "TITLE",
      "DATE",
      "STATUS",
    ]);
  });

  it("models parsed ADRs without losing raw status or content", () => {
    const link = {
      relationship: "Superseded by",
      targetHref: "0002-use-postgresql.md",
      targetNumber: 2,
      targetTitle: "Use PostgreSQL",
      rawMarkdown: "Superseded by [2. Use PostgreSQL](0002-use-postgresql.md)",
    } satisfies AdrLink;
    const record = {
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
    } satisfies AdrRecord;
    const config = {
      cwd: "/repo",
      directory: "/repo/doc/adr",
      defaultStatus: DEFAULT_ADR_STATUS,
    } satisfies AdrRepositoryConfig;
    const templateValues = {
      NUMBER: "1",
      TITLE: record.title,
      DATE: "2026-05-25",
      STATUS: DEFAULT_ADR_STATUS,
    } satisfies AdrTemplateValues;

    expect(record.status).toBeNull();
    expect(record.statusText).toContain("Superseded by");
    expect(record.links).toEqual([link]);
    expect(config.directory.endsWith(DEFAULT_ADR_DIRECTORY)).toBe(true);
    expect(templateValues.STATUS).toBe(DEFAULT_ADR_STATUS);
  });
});
