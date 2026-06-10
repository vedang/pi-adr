import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type { AdrRecord, AdrRepositoryConfig, AdrStatus } from "./model";
import { parseAdrFilename, parseAdrMarkdown } from "./parser";
import { formatAdrFilename } from "./slug";
import { loadAdrTemplate, renderAdrTemplate } from "./templates";

const ADR_STATUS_HEADING_PATTERN = /^##\s*Status\s*$/;
const PREV_NAV_LABEL = "<- Prev";
const NEXT_NAV_LABEL = "Next ->";
const PREV_NAV_LINK_PATTERN = markdownLinkPattern(PREV_NAV_LABEL);
const NEXT_NAV_LINK_PATTERN = markdownLinkPattern(NEXT_NAV_LABEL);
const NAVIGATION_LINE_PATTERN = new RegExp(
  `^(?:${PREV_NAV_LINK_PATTERN}(?:\\s*\\|\\s*${NEXT_NAV_LINK_PATTERN})?|${NEXT_NAV_LINK_PATTERN})$`,
);

interface CreateAdrRecordOptions {
  readonly config: AdrRepositoryConfig;
  readonly title: string;
  readonly date: string;
  readonly status?: AdrStatus;
  readonly templatePath?: string;
  readonly number?: number;
}

function resolveRecordNumber(record: AdrRecord): number {
  return parseAdrFilename(record.filename)?.number ?? record.number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markdownLinkPattern(label: string): string {
  return `\\[${escapeRegExp(label)}\\]\\([^)]+\\)`;
}

function navigationLink(label: string, filename: string): string {
  return `[${label}](${filename})`;
}

function isNavigationLine(line: string): boolean {
  return NAVIGATION_LINE_PATTERN.test(line);
}

function navigationLine(prevFilename?: string, nextFilename?: string): string {
  const links = [
    prevFilename ? navigationLink(PREV_NAV_LABEL, prevFilename) : null,
    nextFilename ? navigationLink(NEXT_NAV_LABEL, nextFilename) : null,
  ].filter((link): link is string => link !== null);

  return links.join(" | ");
}

function stripTrailingBlankLines(lines: readonly string[]): string[] {
  const mutableLines = [...lines];

  while (mutableLines.at(-1) === "") {
    mutableLines.pop();
  }

  return mutableLines;
}

function replaceNavigationBlock(
  content: string,
  navigationLineText: string,
): string {
  const lines = content.split(/\r?\n/);
  const statusHeadingIndex = lines.findIndex((line) =>
    ADR_STATUS_HEADING_PATTERN.test(line),
  );

  if (statusHeadingIndex === -1) {
    return content;
  }

  let prefix = stripTrailingBlankLines(lines.slice(0, statusHeadingIndex));

  const lastPrefixLine = prefix.at(-1);
  if (lastPrefixLine !== undefined && isNavigationLine(lastPrefixLine.trim())) {
    prefix = stripTrailingBlankLines(prefix.slice(0, -1));
  }

  const normalizedPrefix = prefix.length === 0 ? prefix : [...prefix, ""];

  if (!navigationLineText) {
    return [...normalizedPrefix, ...lines.slice(statusHeadingIndex)].join("\n");
  }

  return [
    ...normalizedPrefix,
    navigationLineText,
    "",
    ...lines.slice(statusHeadingIndex),
  ].join("\n");
}

export function refreshNavigationLinks(directory: string): void {
  const records = listAdrRecords(directory);

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const previousRecord = records[index - 1];
    const nextRecord = records[index + 1];
    const line = navigationLine(previousRecord?.filename, nextRecord?.filename);

    const updatedContent = replaceNavigationBlock(record.rawContent, line);

    if (updatedContent !== record.rawContent) {
      writeFileSync(record.filePath, updatedContent);
    }
  }
}

export function listAdrRecords(directory: string): AdrRecord[] {
  if (!existsSync(directory)) {
    return [];
  }

  const records: AdrRecord[] = [];
  const seenNumbers = new Set<number>();

  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const filename = entry.name;
    const parsedFilename = parseAdrFilename(filename);
    if (!parsedFilename) {
      continue;
    }

    if (seenNumbers.has(parsedFilename.number)) {
      throw new Error(`Duplicate ADR number ${parsedFilename.number}`);
    }

    const filePath = path.join(directory, filename);
    const rawContent = readFileSync(filePath, "utf8");
    const record = parseAdrMarkdown(filePath, rawContent);

    seenNumbers.add(parsedFilename.number);
    records.push(record);
  }

  return records.sort((a, b) => {
    return (
      resolveRecordNumber(a) - resolveRecordNumber(b) ||
      a.filename.localeCompare(b.filename)
    );
  });
}

export function getNextAdrNumber(records: readonly AdrRecord[]): number {
  const max = records.reduce((acc, record) => {
    return Math.max(acc, resolveRecordNumber(record));
  }, 0);

  return max + 1;
}

export function createAdrRecord({
  config,
  title,
  date,
  status,
  templatePath,
  number,
}: CreateAdrRecordOptions): AdrRecord {
  const adrDirectory = config.directory;
  mkdirSync(adrDirectory, { recursive: true });

  const records = listAdrRecords(adrDirectory);
  const chosenNumber = number ?? getNextAdrNumber(records);
  const filename = formatAdrFilename(chosenNumber, title);
  const filePath = path.join(adrDirectory, filename);

  if (existsSync(filePath)) {
    throw new Error(`ADR file already exists: ${filePath}`);
  }

  const duplicateRecord = records.find((record) => {
    return resolveRecordNumber(record) === chosenNumber;
  });
  if (duplicateRecord) {
    throw new Error(
      `Duplicate ADR number ${chosenNumber}: ${duplicateRecord.filename}`,
    );
  }

  const { content: template } = loadAdrTemplate(
    adrDirectory,
    templatePath ?? config.templatePath,
  );

  const rawContent = renderAdrTemplate(template, {
    NUMBER: String(chosenNumber),
    TITLE: title,
    DATE: date,
    STATUS: status ?? config.defaultStatus,
  });

  try {
    writeFileSync(filePath, rawContent, { flag: "wx" });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`ADR file already exists: ${filePath}`);
    }
    throw error;
  }

  refreshNavigationLinks(adrDirectory);

  const refreshedContent = readFileSync(filePath, "utf8");
  return parseAdrMarkdown(filePath, refreshedContent);
}
