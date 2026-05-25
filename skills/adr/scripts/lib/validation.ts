import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { ADR_STATUS_VALUES, type AdrRecord } from "./model";
import { parseAdrFilename, parseAdrMarkdown } from "./parser";

interface AdrValidationIssue {
  readonly filePath: string;
  readonly line?: number;
  readonly message: string;
}

interface AdrValidationEntry {
  readonly record: AdrRecord;
  readonly filenameNumber: number;
  readonly filename: string;
  readonly filePath: string;
  readonly rawContent: string;
}

interface SectionBounds {
  readonly headerLine: number;
  readonly endLine: number;
}

const ADR_HEADING_PATTERN = /^#\s*(\d+)\.\s*(.+)\s*$/;
const DATE_PATTERN = /^Date:\s*(.*)\s*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEADING_PATTERN = /^#{1,6}\s+/;
const REQUIRED_SECTIONS = [
  "Status",
  "Context",
  "Decision",
  "Consequences",
] as const;
const STATUS_VALUES = ADR_STATUS_VALUES.join(", ");

function issue(
  filePath: string,
  message: string,
  line?: number,
): AdrValidationIssue {
  return line === undefined
    ? { filePath, message }
    : { filePath, line, message };
}

function readAdrEntries(directory: string): AdrValidationEntry[] {
  if (!existsSync(directory)) {
    return [];
  }

  const entries: AdrValidationEntry[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const parsedFilename = parseAdrFilename(entry.name);
    if (!parsedFilename) {
      continue;
    }

    const filePath = path.join(directory, entry.name);
    const rawContent = readFileSync(filePath, "utf8");

    entries.push({
      record: parseAdrMarkdown(filePath, rawContent),
      filenameNumber: parsedFilename.number,
      filename: entry.name,
      filePath,
      rawContent,
    });
  }

  return entries.sort((a, b) => a.filename.localeCompare(b.filename));
}

function linesOf(content: string): string[] {
  return content.split(/\r?\n/);
}

function findAdrHeading(lines: readonly string[]): {
  readonly number: number;
  readonly line: number;
} | null {
  for (let index = 0; index < lines.length; index += 1) {
    const match = ADR_HEADING_PATTERN.exec(lines[index]);
    if (match) {
      return { number: Number(match[1]), line: index + 1 };
    }
  }

  return null;
}

function sectionPattern(sectionName: string): RegExp {
  return new RegExp(`^##\\s*${sectionName}\\s*$`, "i");
}

function findSection(
  lines: readonly string[],
  sectionName: string,
): SectionBounds | null {
  const pattern = sectionPattern(sectionName);
  const headerIndex = lines.findIndex((line) => pattern.test(line));

  if (headerIndex === -1) {
    return null;
  }

  let endLine = lines.length + 1;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    if (HEADING_PATTERN.test(lines[index])) {
      endLine = index + 1;
      break;
    }
  }

  return { headerLine: headerIndex + 1, endLine };
}

function findDateLine(lines: readonly string[]): {
  readonly line: number;
  readonly value: string;
} | null {
  for (let index = 0; index < lines.length; index += 1) {
    const match = DATE_PATTERN.exec(lines[index]);
    if (match) {
      return { line: index + 1, value: match[1].trim() };
    }
  }

  return null;
}

function firstNonEmptyLine(
  lines: readonly string[],
  startLine: number,
  endLine: number,
): {
  readonly line: number;
  readonly value: string;
} | null {
  for (let line = startLine; line < endLine; line += 1) {
    const value = lines[line - 1]?.trim() ?? "";
    if (value) {
      return { line, value };
    }
  }

  return null;
}

function validateDuplicateNumbers(
  entries: readonly AdrValidationEntry[],
): AdrValidationIssue[] {
  const byNumber = new Map<number, AdrValidationEntry[]>();

  for (const entry of entries) {
    const duplicateEntries = byNumber.get(entry.filenameNumber) ?? [];
    duplicateEntries.push(entry);
    byNumber.set(entry.filenameNumber, duplicateEntries);
  }

  const issues: AdrValidationIssue[] = [];

  for (const [number, duplicateEntries] of byNumber) {
    if (duplicateEntries.length < 2) {
      continue;
    }

    for (const entry of duplicateEntries) {
      const otherFilenames = duplicateEntries
        .filter((otherEntry) => otherEntry !== entry)
        .map((otherEntry) => otherEntry.filename)
        .join(", ");

      issues.push(
        issue(
          entry.filePath,
          `Duplicate ADR number ${number} also used by ${otherFilenames}`,
        ),
      );
    }
  }

  return issues;
}

function validateStructure(entry: AdrValidationEntry): AdrValidationIssue[] {
  const lines = linesOf(entry.rawContent);
  const issues: AdrValidationIssue[] = [];
  const heading = findAdrHeading(lines);

  if (!heading) {
    issues.push(
      issue(entry.filePath, "ADR is missing required heading: # N. Title"),
    );
  } else if (heading.number !== entry.filenameNumber) {
    issues.push(
      issue(
        entry.filePath,
        `ADR heading number ${heading.number} does not match filename number ${entry.filenameNumber}`,
        heading.line,
      ),
    );
  }

  const dateLine = findDateLine(lines);
  if (!dateLine) {
    issues.push(
      issue(entry.filePath, "ADR is missing required date: Date: YYYY-MM-DD"),
    );
  } else if (!ISO_DATE_PATTERN.test(dateLine.value)) {
    issues.push(
      issue(
        entry.filePath,
        "ADR date must use ISO format YYYY-MM-DD",
        dateLine.line,
      ),
    );
  }

  for (const sectionName of REQUIRED_SECTIONS) {
    if (!findSection(lines, sectionName)) {
      issues.push(
        issue(
          entry.filePath,
          `ADR is missing required section: ${sectionName}`,
        ),
      );
    }
  }

  const statusSection = findSection(lines, "Status");
  if (!statusSection) {
    return issues;
  }

  const statusLine = firstNonEmptyLine(
    lines,
    statusSection.headerLine + 1,
    statusSection.endLine,
  );

  if (!statusLine) {
    issues.push(
      issue(
        entry.filePath,
        "ADR Status section must contain a status value",
        statusSection.headerLine,
      ),
    );
  } else if (
    !(ADR_STATUS_VALUES as readonly string[]).includes(statusLine.value)
  ) {
    issues.push(
      issue(
        entry.filePath,
        `ADR status must be one of: ${STATUS_VALUES}`,
        statusLine.line,
      ),
    );
  }

  return issues;
}

function stripHrefAnchorAndQuery(href: string): string {
  return href.split("#", 1)[0].split("?", 1)[0];
}

function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function findLinkLine(
  entry: AdrValidationEntry,
  rawMarkdown: string,
): number | undefined {
  const lines = linesOf(entry.rawContent);
  const lineIndex = lines.findIndex((line) => line.includes(rawMarkdown));

  return lineIndex === -1 ? undefined : lineIndex + 1;
}

function validateLinks(
  entries: readonly AdrValidationEntry[],
): AdrValidationIssue[] {
  const filenames = new Set(entries.map((entry) => entry.filename));
  const issues: AdrValidationIssue[] = [];

  for (const entry of entries) {
    for (const link of entry.record.links) {
      if (isExternalHref(link.targetHref)) {
        continue;
      }

      const href = stripHrefAnchorAndQuery(link.targetHref);
      const targetFilename = path.basename(href);

      if (targetFilename && filenames.has(targetFilename)) {
        continue;
      }

      issues.push(
        issue(
          entry.filePath,
          `ADR status link target does not exist: ${link.targetHref}`,
          findLinkLine(entry, link.rawMarkdown),
        ),
      );
    }
  }

  return issues;
}

export function validateAdrDirectory(directory: string): AdrValidationIssue[] {
  const entries = readAdrEntries(directory);

  return [
    ...validateDuplicateNumbers(entries),
    ...entries.flatMap((entry) => validateStructure(entry)),
    ...validateLinks(entries),
  ];
}
