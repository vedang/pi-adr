import path from "node:path";

import {
  ADR_LINK_RELATIONSHIPS as ADR_LINK_RELATIONSHIP_MAP,
  type AdrLink,
  type AdrRecord,
  type AdrStatus,
  isAdrStatus,
} from "./model";

interface ParsedAdrFilename {
  readonly number: number;
  readonly paddedNumber: string;
  readonly slug: string;
}

const ADR_FILENAME_PATTERN = /^(\d{4})-(.+)\.md$/;
const ADR_HEADING_PATTERN = /^#\s*(\d+)\.\s*(.+)\s*$/m;
const ADR_DATE_PATTERN = /^Date:\s*(\d{4}-\d{2}-\d{2})\s*$/m;
const ADR_STATUS_HEADING_PATTERN = /^##\s*Status\s*$/;
const HEADING_PATTERN = /^#{1,6}\s+/;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const SUPERSEDED_BY_LINK_PATTERN =
  /^Super(?:s|c)eded by\s+\[[^\]]+\]\([^)]+\)$/;

const ADR_LINK_RELATIONSHIP_LABELS: ReadonlySet<string> = new Set(
  Object.values(ADR_LINK_RELATIONSHIP_MAP).flatMap(({ forward, reverse }) => [
    forward,
    reverse,
  ]),
);

export function parseAdrFilename(filename: string): ParsedAdrFilename | null {
  const base = path.basename(filename);
  const match = ADR_FILENAME_PATTERN.exec(base);

  if (!match) {
    return null;
  }

  const [, paddedNumber, slug] = match;
  return {
    number: Number(paddedNumber),
    paddedNumber,
    slug,
  };
}

export function extractAdrStatusBlock(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const statusHeaderIndex = lines.findIndex((line) =>
    ADR_STATUS_HEADING_PATTERN.test(line),
  );

  if (statusHeaderIndex === -1) {
    return "";
  }

  const statusLines: string[] = [];

  for (let i = statusHeaderIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];

    if (HEADING_PATTERN.test(line)) {
      break;
    }

    statusLines.push(line);
  }

  return statusLines.join("\n").trim();
}

export function isSupersededByStatusLine(value: string): boolean {
  return SUPERSEDED_BY_LINK_PATTERN.test(value);
}

function parseAdrDate(markdown: string): string | null {
  const match = ADR_DATE_PATTERN.exec(markdown);
  return match ? match[1] : null;
}

function parseAdrStatus(markdown: string): AdrStatus | null {
  const firstNonEmptyLine = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstNonEmptyLine) {
    return null;
  }

  if (isAdrStatus(firstNonEmptyLine)) {
    return firstNonEmptyLine;
  }

  return isSupersededByStatusLine(firstNonEmptyLine) ? "Superseded" : null;
}

function parseAdrHeading(markdown: string): {
  readonly number: number;
  readonly title: string;
} | null {
  const match = ADR_HEADING_PATTERN.exec(markdown);

  if (!match) {
    return null;
  }

  return {
    number: Number(match[1]),
    title: match[2],
  };
}

function parseAdrStatusLinks(statusText: string): AdrLink[] {
  const lines = statusText.split(/\r?\n/);
  const links: AdrLink[] = [];

  for (const line of lines) {
    for (const match of line.matchAll(MARKDOWN_LINK_PATTERN)) {
      const matchIndex = match.index ?? 0;
      const relationship = line
        .slice(0, matchIndex)
        .replace(/^\s*[-*+]\s*/, "")
        .trim();

      if (!ADR_LINK_RELATIONSHIP_LABELS.has(relationship)) {
        continue;
      }

      const rawMarkdown = match[0];
      const label = match[1] ?? "";
      const targetHref = match[2] ?? "";
      const labelMatch = /^(\d+)\.\s*(.+)$/.exec(label);

      links.push(
        labelMatch
          ? {
              relationship,
              targetHref,
              targetNumber: Number(labelMatch[1]),
              targetTitle: labelMatch[2],
              rawMarkdown,
            }
          : {
              relationship,
              targetHref,
              rawMarkdown,
            },
      );
    }
  }

  return links;
}

export function parseAdrMarkdown(
  filePath: string,
  rawContent: string,
): AdrRecord {
  const filename = path.basename(filePath);
  const parsedFilename = parseAdrFilename(filename);

  if (!parsedFilename) {
    throw new Error(`Invalid ADR filename: ${filename}`);
  }

  const statusText = extractAdrStatusBlock(rawContent);
  const status = parseAdrStatus(statusText);
  const date = parseAdrDate(rawContent);
  const heading = parseAdrHeading(rawContent);
  const links = parseAdrStatusLinks(statusText);

  return {
    number: heading?.number ?? parsedFilename.number,
    title: heading?.title ?? parsedFilename.slug,
    filename,
    filePath,
    date,
    status,
    statusText,
    links,
    rawContent,
  };
}
