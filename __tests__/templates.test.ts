import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ADR_STATUS } from "../skills/adr/scripts/lib/model";
import {
  DEFAULT_ADR_TEMPLATE,
  INITIAL_ADR_TEMPLATE,
  loadAdrTemplate,
  renderAdrTemplate,
} from "../skills/adr/scripts/lib/templates";

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-templates-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ADR templates", () => {
  it("renders default placeholders", () => {
    expect(
      renderAdrTemplate(DEFAULT_ADR_TEMPLATE, {
        NUMBER: "7",
        TITLE: "Use PostgreSQL",
        DATE: "2026-05-25",
        STATUS: DEFAULT_ADR_STATUS,
      }),
    ).toBe(`# 7. Use PostgreSQL

Date: 2026-05-25

## Status

Accepted

## Context

## Decision

## Consequences
`);
  });

  it("falls back to the bundled default template", () => {
    const root = makeTempRoot();

    expect(loadAdrTemplate(root)).toEqual({
      content: DEFAULT_ADR_TEMPLATE,
      source: "default",
    });
  });

  it("loads a project-specific adr-tools template", () => {
    const root = makeTempRoot();
    const templatePath = path.join(root, "templates", "template.md");
    mkdirSync(path.dirname(templatePath), { recursive: true });
    writeFileSync(templatePath, "# NUMBER - TITLE\n\nSTATUS on DATE\n");

    expect(loadAdrTemplate(root)).toEqual({
      content: "# NUMBER - TITLE\n\nSTATUS on DATE\n",
      source: templatePath,
    });
  });

  it("prefers an explicit template override", () => {
    const root = makeTempRoot();
    const adrTemplatePath = path.join(root, "templates", "template.md");
    const explicitTemplatePath = path.join(root, "custom-template.md");
    mkdirSync(path.dirname(adrTemplatePath), { recursive: true });
    writeFileSync(adrTemplatePath, "# NUMBER. TITLE\n");
    writeFileSync(explicitTemplatePath, "# TITLE (#NUMBER)\n");

    expect(loadAdrTemplate(root, explicitTemplatePath)).toEqual({
      content: "# TITLE (#NUMBER)\n",
      source: explicitTemplatePath,
    });
  });

  it("exposes the initial ADR template", () => {
    expect(
      renderAdrTemplate(INITIAL_ADR_TEMPLATE, {
        NUMBER: "1",
        TITLE: "Record architecture decisions",
        DATE: "2026-05-25",
        STATUS: DEFAULT_ADR_STATUS,
      }),
    ).toContain(
      "We will record architecture decisions as numbered Markdown files",
    );
  });
});
