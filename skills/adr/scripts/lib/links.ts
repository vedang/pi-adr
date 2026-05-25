import { writeFileSync } from "node:fs";

import { ADR_LINK_RELATIONSHIPS, type AdrRecord } from "./model";
import { parseAdrFilename } from "./parser";

type SupersedeSpelling = "standard" | "adr-tools";

interface LinkAdrRecordsOptions {
  readonly source: AdrRecord;
  readonly relationship: string;
  readonly target: AdrRecord;
  readonly reverseRelationship: string;
}

interface SupersedeAdrRecordsOptions {
  readonly supersedingRecord: AdrRecord;
  readonly supersededRecords: readonly AdrRecord[];
  readonly spelling?: SupersedeSpelling;
}

interface StatusSectionBounds {
  readonly lines: string[];
  readonly headerIndex: number;
  readonly endIndex: number;
}

const HEADING_PATTERN = /^#{1,6}\s+/;
const STATUS_HEADING_PATTERN = /^##\s*Status\s*$/;
const REPLACEABLE_SUPERSEDE_STATUS_PATTERN = /^(Accepted|Proposed)$/;

function recordNumber(record: AdrRecord): number {
  return parseAdrFilename(record.filename)?.number ?? record.number;
}

function uniqueRecords(records: readonly AdrRecord[]): AdrRecord[] {
  return [...new Set(records)];
}

function findStatusSection(content: string): StatusSectionBounds {
  const lines = content.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    STATUS_HEADING_PATTERN.test(line),
  );

  if (headerIndex === -1) {
    throw new Error("ADR has no Status section");
  }

  let endIndex = lines.length;

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    if (HEADING_PATTERN.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  return { lines, headerIndex, endIndex };
}

function extractStatusLines(content: string): string[] {
  const { lines, headerIndex, endIndex } = findStatusSection(content);
  const statusLines = lines.slice(headerIndex + 1, endIndex);

  while (statusLines.length > 0 && statusLines[0].trim() === "") {
    statusLines.shift();
  }
  while (
    statusLines.length > 0 &&
    statusLines[statusLines.length - 1].trim() === ""
  ) {
    statusLines.pop();
  }

  return statusLines;
}

function replaceStatusLines(
  content: string,
  statusLines: readonly string[],
): string {
  const { lines, headerIndex, endIndex } = findStatusSection(content);
  const replacement = [
    ...lines.slice(0, headerIndex + 1),
    "",
    ...statusLines,
    "",
    ...lines.slice(endIndex),
  ];

  return replacement.join("\n");
}

function appendStatusLink(content: string, linkLine: string): string {
  const statusLines = extractStatusLines(content);

  if (statusLines.some((line) => line.trim() === linkLine)) {
    return content;
  }

  if (statusLines.length === 0) {
    return replaceStatusLines(content, [linkLine]);
  }

  return replaceStatusLines(content, [...statusLines, "", linkLine]);
}

function replaceSupersededStatus(content: string, linkLine: string): string {
  const statusLines = extractStatusLines(content);

  if (statusLines.some((line) => line.trim() === linkLine)) {
    return content;
  }

  const statusIndex = statusLines.findIndex((line) =>
    REPLACEABLE_SUPERSEDE_STATUS_PATTERN.test(line.trim()),
  );

  if (statusIndex === -1) {
    return replaceStatusLines(content, [linkLine, "", ...statusLines]);
  }

  const nextStatusLines = statusLines.map((line, index) =>
    index === statusIndex ? linkLine : line,
  );

  return replaceStatusLines(content, nextStatusLines);
}

function formatAdrStatusLink(relationship: string, target: AdrRecord): string {
  return `${relationship} [${recordNumber(target)}. ${target.title}](${target.filename})`;
}

function supersedeRelationships(spelling: SupersedeSpelling): {
  readonly forward: string;
  readonly reverse: string;
} {
  return spelling === "adr-tools"
    ? ADR_LINK_RELATIONSHIPS.supercedes
    : ADR_LINK_RELATIONSHIPS.supersedes;
}

export function isSupersedesRelationship(relationship: string): boolean {
  return (
    relationship === ADR_LINK_RELATIONSHIPS.supersedes.forward ||
    relationship === ADR_LINK_RELATIONSHIPS.supercedes.forward
  );
}

export function isSupersededByRelationship(relationship: string): boolean {
  return (
    relationship === ADR_LINK_RELATIONSHIPS.supersedes.reverse ||
    relationship === ADR_LINK_RELATIONSHIPS.supercedes.reverse
  );
}

export function resolveAdrReference(
  records: readonly AdrRecord[],
  reference: string,
): AdrRecord {
  const trimmedReference = reference.trim();

  if (!trimmedReference) {
    throw new Error("ADR reference is empty");
  }

  const basenameReference = trimmedReference.split(/[\\/]/).at(-1) ?? "";
  const numberReference = /^\d+$/.test(trimmedReference)
    ? Number(trimmedReference)
    : null;

  if (numberReference !== null) {
    const matches = records.filter(
      (record) => recordNumber(record) === numberReference,
    );
    return resolveUniqueMatch(trimmedReference, matches);
  }

  const exactFilenameMatches = records.filter(
    (record) => record.filename === basenameReference,
  );
  if (exactFilenameMatches.length > 0) {
    return resolveUniqueMatch(trimmedReference, exactFilenameMatches);
  }

  const loweredReference = trimmedReference.toLowerCase();
  const substringMatches = records.filter((record) => {
    return (
      record.filename.toLowerCase().includes(loweredReference) ||
      record.title.toLowerCase().includes(loweredReference)
    );
  });

  return resolveUniqueMatch(trimmedReference, substringMatches);
}

function resolveUniqueMatch(
  reference: string,
  matches: readonly AdrRecord[],
): AdrRecord {
  const uniqueMatches = uniqueRecords(matches);

  if (uniqueMatches.length === 1) {
    return uniqueMatches[0];
  }

  if (uniqueMatches.length === 0) {
    throw new Error(`No ADR matches reference: ${reference}`);
  }

  const filenames = uniqueMatches.map((record) => record.filename).join(", ");
  throw new Error(`Ambiguous ADR reference ${reference}: ${filenames}`);
}

export function linkAdrRecords({
  source,
  relationship,
  target,
  reverseRelationship,
}: LinkAdrRecordsOptions): void {
  const sourceContent = appendStatusLink(
    source.rawContent,
    formatAdrStatusLink(relationship, target),
  );
  const targetContent = appendStatusLink(
    target.rawContent,
    formatAdrStatusLink(reverseRelationship, source),
  );

  writeFileSync(source.filePath, sourceContent);
  writeFileSync(target.filePath, targetContent);
}

export function supersedeAdrRecords({
  supersedingRecord,
  supersededRecords,
  spelling = "standard",
}: SupersedeAdrRecordsOptions): void {
  const relationships = supersedeRelationships(spelling);
  let supersedingContent = supersedingRecord.rawContent;

  for (const supersededRecord of supersededRecords) {
    supersedingContent = appendStatusLink(
      supersedingContent,
      formatAdrStatusLink(relationships.forward, supersededRecord),
    );

    const supersededContent = replaceSupersededStatus(
      supersededRecord.rawContent,
      formatAdrStatusLink(relationships.reverse, supersedingRecord),
    );
    writeFileSync(supersededRecord.filePath, supersededContent);
  }

  writeFileSync(supersedingRecord.filePath, supersedingContent);
}
