import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ADR_STATUS } from "../skills/adr/scripts/lib/model";
import type { AdrTemplateValues } from "../skills/adr/scripts/lib/model";
import {
  DEFAULT_ADR_TEMPLATE,
  INITIAL_ADR_TEMPLATE,
  loadAdrTemplate,
  renderAdrTemplate,
} from "../skills/adr/scripts/lib/templates";

const TEST_DATE = "2026-05-25";
const PROJECT_TEMPLATE = "# NUMBER - TITLE\n\nSTATUS on DATE\n";

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-templates-"));
  tempRoots.push(root);
  return root;
}

function adrTemplateValues(number: string, title: string): AdrTemplateValues {
  return {
    NUMBER: number,
    TITLE: title,
    DATE: TEST_DATE,
    STATUS: DEFAULT_ADR_STATUS,
  };
}

function writeTemplateFixture(
  root: string,
  relativePath: string,
  content: string,
): string {
  const templatePath = path.join(root, relativePath);
  mkdirSync(path.dirname(templatePath), { recursive: true });
  writeFileSync(templatePath, content);
  return templatePath;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ADR templates", () => {
  it("renders default placeholders", () => {
    expect(
      renderAdrTemplate(
        DEFAULT_ADR_TEMPLATE,
        adrTemplateValues("7", "Use PostgreSQL"),
      ),
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
    const templatePath = writeTemplateFixture(
      root,
      "templates/template.md",
      PROJECT_TEMPLATE,
    );

    expect(loadAdrTemplate(root)).toEqual({
      content: PROJECT_TEMPLATE,
      source: templatePath,
    });
  });

  it("prefers an explicit template override", () => {
    const root = makeTempRoot();
    const explicitTemplate = "# TITLE (#NUMBER)\n";
    writeTemplateFixture(root, "templates/template.md", "# NUMBER. TITLE\n");
    const explicitTemplatePath = writeTemplateFixture(
      root,
      "custom-template.md",
      explicitTemplate,
    );

    expect(loadAdrTemplate(root, explicitTemplatePath)).toEqual({
      content: explicitTemplate,
      source: explicitTemplatePath,
    });
  });

  it("exposes the initial ADR template", () => {
    expect(
      renderAdrTemplate(
        INITIAL_ADR_TEMPLATE,
        adrTemplateValues("1", "Record architecture decisions"),
      ),
    ).toContain(
      "We will record architecture decisions as numbered Markdown files",
    );
  });
});
