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

interface CreateAdrRecordOptions {
  readonly config: AdrRepositoryConfig;
  readonly title: string;
  readonly date: string;
  readonly status?: AdrStatus;
  readonly templatePath?: string;
  readonly number?: number;
}

function getRecordFilenameNumber(record: AdrRecord): number {
  return parseAdrFilename(record.filename)?.number ?? record.number;
}

function sortedByNumber(records: readonly AdrRecord[]): AdrRecord[] {
  return [...records].sort((a, b) => {
    return (
      getRecordFilenameNumber(a) - getRecordFilenameNumber(b) ||
      a.filename.localeCompare(b.filename)
    );
  });
}

function findRecordWithNumber(
  records: readonly AdrRecord[],
  number: number,
): AdrRecord | undefined {
  return records.find((record) => getRecordFilenameNumber(record) === number);
}

function isMissingDirectory(pathname: string): boolean {
  return !existsSync(pathname);
}

export function listAdrRecords(directory: string): AdrRecord[] {
  if (isMissingDirectory(directory)) {
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

  return sortedByNumber(records);
}

export function getNextAdrNumber(records: readonly AdrRecord[]): number {
  const max = records.reduce((acc, record) => {
    return Math.max(acc, getRecordFilenameNumber(record));
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

  const duplicateRecord = findRecordWithNumber(records, chosenNumber);
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

  return parseAdrMarkdown(filePath, rawContent);
}
