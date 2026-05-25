import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { AdrTemplateValues } from "./model";

export const DEFAULT_ADR_TEMPLATE = `# NUMBER. TITLE

Date: DATE

## Status

STATUS

## Context

## Decision

## Consequences
`;

export const INITIAL_ADR_TEMPLATE = `# 1. Record architecture decisions

Date: DATE

## Status

Accepted

## Context

The project needs a lightweight way to preserve important architecture decisions and the forces that shaped them.

## Decision

We will record architecture decisions as numbered Markdown files in version control.

## Consequences

Future maintainers can understand why decisions were made. The project gains a small documentation maintenance obligation. Superseded decisions remain available as historical context.
`;

function readTemplateFile(templatePath: string): string {
  return readFileSync(templatePath, "utf8");
}

export function loadAdrTemplate(
  adrDirectory: string,
  explicitTemplatePath?: string,
): { content: string; source: string } {
  if (explicitTemplatePath !== undefined) {
    return {
      content: readTemplateFile(explicitTemplatePath),
      source: explicitTemplatePath,
    };
  }

  const templatePath = path.join(adrDirectory, "templates", "template.md");
  if (existsSync(templatePath)) {
    return {
      content: readTemplateFile(templatePath),
      source: templatePath,
    };
  }

  return {
    content: DEFAULT_ADR_TEMPLATE,
    source: "default",
  };
}

export function renderAdrTemplate(
  template: string,
  values: AdrTemplateValues,
): string {
  return template.replace(/NUMBER|TITLE|DATE|STATUS/g, (placeholder) => {
    return values[placeholder as keyof AdrTemplateValues];
  });
}
