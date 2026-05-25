#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { discoverAdrRepositoryConfig } from "./lib/directory";
import {
  linkAdrRecords,
  resolveAdrReference,
  supersedeAdrRecords,
} from "./lib/links";
import {
  ADR_STATUS_VALUES,
  type AdrRecord,
  type AdrRepositoryConfig,
  type AdrStatus,
  DEFAULT_ADR_DIRECTORY,
  DEFAULT_ADR_STATUS,
} from "./lib/model";
import { generateAdrGraph, generateAdrToc } from "./lib/reports";
import { createAdrRecord, listAdrRecords } from "./lib/repository";
import { formatAdrFilename, slugifyAdrTitle } from "./lib/slug";
import { INITIAL_ADR_TEMPLATE, renderAdrTemplate } from "./lib/templates";
import { validateAdrDirectory } from "./lib/validation";

interface RunAdrScriptOptions {
  readonly cwd?: string;
  readonly date?: string;
  readonly stdout?: (line: string) => void;
  readonly stderr?: (line: string) => void;
}

interface AdrScriptRuntime {
  readonly cwd: string;
  readonly date: string;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

interface NewAdrLinkSpec {
  readonly targetReference: string;
  readonly relationship: string;
  readonly reverseRelationship: string;
}

interface NewAdrCommandOptions {
  readonly title: string;
  readonly status?: AdrStatus;
  readonly supersedes: readonly string[];
  readonly links: readonly NewAdrLinkSpec[];
}

interface ReportCommandOptions {
  readonly prefix?: string;
  readonly extension?: string;
}

const INITIAL_ADR_TITLE = "Record architecture decisions";
const ADR_DIR_MARKER = ".adr-dir";

function usage(): string {
  return `Usage:
  adr.ts init [directory]
  adr.ts new [--status STATUS] [--supersedes REF]... [--link REF:LINK:REVERSE]... <title...>
  adr.ts link <source> <link> <target> <reverse-link>
  adr.ts list
  adr.ts toc [--prefix PREFIX]
  adr.ts graph [--prefix PREFIX] [--extension EXT]
  adr.ts validate
  adr.ts slug <title...>
  adr.ts filename <number> <title...>
`;
}

function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function runtimeFromOptions(options: RunAdrScriptOptions): AdrScriptRuntime {
  return {
    cwd: path.resolve(options.cwd ?? process.cwd()),
    date: options.date ?? defaultDate(),
    stdout: options.stdout ?? ((line) => console.log(line)),
    stderr: options.stderr ?? ((line) => console.error(line)),
  };
}

function commandConfig(runtime: AdrScriptRuntime): AdrRepositoryConfig {
  return discoverAdrRepositoryConfig(runtime.cwd);
}

function explicitDirectoryConfig(
  runtime: AdrScriptRuntime,
  directory: string,
): AdrRepositoryConfig {
  return {
    cwd: runtime.cwd,
    directory: path.resolve(runtime.cwd, directory),
    defaultStatus: DEFAULT_ADR_STATUS,
  };
}

function requireArg(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function parseAdrStatus(value: string): AdrStatus {
  if ((ADR_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as AdrStatus;
  }

  throw new Error(`ADR status must be one of: ${ADR_STATUS_VALUES.join(", ")}`);
}

function parseLinkSpec(value: string): NewAdrLinkSpec {
  const parts = value.split(":").map((part) => part.trim());
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error("--link must use REF:LINK:REVERSE format");
  }

  return {
    targetReference: parts[0],
    relationship: parts[1],
    reverseRelationship: parts[2],
  };
}

function parseNewArgs(args: readonly string[]): NewAdrCommandOptions {
  const titleParts: string[] = [];
  const supersedes: string[] = [];
  const links: NewAdrLinkSpec[] = [];
  let status: AdrStatus | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--status") {
      index += 1;
      status = parseAdrStatus(
        requireArg(args[index], "Missing value for --status"),
      );
      continue;
    }

    if (arg === "--supersedes") {
      index += 1;
      supersedes.push(
        requireArg(args[index], "Missing value for --supersedes"),
      );
      continue;
    }

    if (arg === "--link") {
      index += 1;
      links.push(
        parseLinkSpec(requireArg(args[index], "Missing value for --link")),
      );
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option for new: ${arg}`);
    }

    titleParts.push(arg);
  }

  const title = titleParts.join(" ").trim();
  if (!title) {
    throw new Error("Missing ADR title.");
  }

  return { title, status, supersedes, links };
}

function parseReportArgs(
  args: readonly string[],
  commandName: "toc" | "graph",
): ReportCommandOptions {
  let prefix: string | undefined;
  let extension: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--prefix") {
      index += 1;
      prefix = requireArg(args[index], "Missing value for --prefix");
      continue;
    }

    if (arg === "--extension" && commandName === "graph") {
      index += 1;
      extension = requireArg(args[index], "Missing value for --extension");
      continue;
    }

    throw new Error(`Unknown ${commandName.toUpperCase()} option: ${arg}`);
  }

  return { prefix, extension };
}

function writeAdrDirMarkerIfNeeded(
  runtime: AdrScriptRuntime,
  directoryArgument: string | undefined,
): void {
  if (
    directoryArgument === undefined ||
    path.normalize(directoryArgument) === DEFAULT_ADR_DIRECTORY
  ) {
    return;
  }

  const markerPath = path.join(runtime.cwd, ADR_DIR_MARKER);
  if (existsSync(markerPath)) {
    const currentValue = readFileSync(markerPath, "utf8").trim();
    if (currentValue !== directoryArgument) {
      throw new Error(
        `.adr-dir already points to ${currentValue}, not ${directoryArgument}`,
      );
    }
    return;
  }

  writeFileSync(markerPath, `${directoryArgument}\n`, { flag: "wx" });
}

function initAdrDirectory(
  runtime: AdrScriptRuntime,
  args: readonly string[],
): number {
  if (args.length > 1) {
    throw new Error(`Too many arguments for init.\n${usage()}`);
  }

  const [directoryArgument] = args;
  const config = directoryArgument
    ? explicitDirectoryConfig(runtime, directoryArgument)
    : commandConfig(runtime);
  const records = listAdrRecords(config.directory);

  if (records.length > 0) {
    throw new Error(
      `ADR directory already contains records: ${config.directory}`,
    );
  }

  writeAdrDirMarkerIfNeeded(runtime, directoryArgument);
  mkdirSync(config.directory, { recursive: true });

  const filePath = path.join(
    config.directory,
    formatAdrFilename(1, INITIAL_ADR_TITLE),
  );
  const rawContent = renderAdrTemplate(INITIAL_ADR_TEMPLATE, {
    NUMBER: "1",
    TITLE: INITIAL_ADR_TITLE,
    DATE: runtime.date,
    STATUS: DEFAULT_ADR_STATUS,
  });

  writeFileSync(filePath, rawContent, { flag: "wx" });
  runtime.stdout(filePath);
  return 0;
}

function findRecordByFilename(
  records: readonly AdrRecord[],
  filename: string,
): AdrRecord {
  const record = records.find((candidate) => candidate.filename === filename);
  if (!record) {
    throw new Error(`Created ADR disappeared from repository: ${filename}`);
  }
  return record;
}

function createNewAdr(
  runtime: AdrScriptRuntime,
  args: readonly string[],
): number {
  const options = parseNewArgs(args);
  const config = commandConfig(runtime);
  const recordsBeforeCreate = listAdrRecords(config.directory);
  const supersededRecords = options.supersedes.map((reference) =>
    resolveAdrReference(recordsBeforeCreate, reference),
  );

  const createdRecord = createAdrRecord({
    config,
    title: options.title,
    date: runtime.date,
    status: options.status,
  });

  if (supersededRecords.length > 0) {
    supersedeAdrRecords({
      supersedingRecord: createdRecord,
      supersededRecords,
    });
  }

  for (const link of options.links) {
    const records = listAdrRecords(config.directory);
    const source = findRecordByFilename(records, createdRecord.filename);
    const target = resolveAdrReference(records, link.targetReference);

    assertDistinctLinkEndpoints(source, target);
    linkAdrRecords({
      source,
      relationship: link.relationship,
      target,
      reverseRelationship: link.reverseRelationship,
    });
  }

  runtime.stdout(createdRecord.filePath);
  return 0;
}

function assertDistinctLinkEndpoints(
  source: AdrRecord,
  target: AdrRecord,
): void {
  if (source.filePath === target.filePath) {
    throw new Error("ADR link source and target must be different records");
  }
}

function linkExistingAdrs(
  runtime: AdrScriptRuntime,
  args: readonly string[],
): number {
  if (args.length !== 4) {
    throw new Error(
      `link requires SOURCE LINK TARGET REVERSE_LINK.\n${usage()}`,
    );
  }

  const [sourceReference, relationship, targetReference, reverseRelationship] =
    args;
  const config = commandConfig(runtime);
  const records = listAdrRecords(config.directory);
  const source = resolveAdrReference(records, sourceReference);
  const target = resolveAdrReference(records, targetReference);

  assertDistinctLinkEndpoints(source, target);
  linkAdrRecords({ source, relationship, target, reverseRelationship });
  runtime.stdout(`${source.filename} ${relationship} ${target.filename}`);
  return 0;
}

function listAdrs(runtime: AdrScriptRuntime, args: readonly string[]): number {
  if (args.length > 0) {
    throw new Error(`list does not accept arguments.\n${usage()}`);
  }

  const config = commandConfig(runtime);
  const records = listAdrRecords(config.directory);

  for (const record of records) {
    runtime.stdout(
      `${record.number}\t${record.status ?? "-"}\t${record.filename}\t${record.title}`,
    );
  }

  return 0;
}

function generateToc(
  runtime: AdrScriptRuntime,
  args: readonly string[],
): number {
  const options = parseReportArgs(args, "toc");
  const config = commandConfig(runtime);
  const records = listAdrRecords(config.directory);

  runtime.stdout(generateAdrToc(records, { linkPrefix: options.prefix }));
  return 0;
}

function generateGraph(
  runtime: AdrScriptRuntime,
  args: readonly string[],
): number {
  const options = parseReportArgs(args, "graph");
  const config = commandConfig(runtime);
  const records = listAdrRecords(config.directory);

  runtime.stdout(
    generateAdrGraph(records, {
      linkPrefix: options.prefix,
      linkExtension: options.extension,
    }),
  );
  return 0;
}

function formatValidationIssue(issue: {
  readonly filePath: string;
  readonly line?: number;
  readonly message: string;
}): string {
  return issue.line === undefined
    ? `${issue.filePath}: ${issue.message}`
    : `${issue.filePath}:${issue.line}: ${issue.message}`;
}

function validateAdrs(
  runtime: AdrScriptRuntime,
  args: readonly string[],
): number {
  if (args.length > 0) {
    throw new Error(`validate does not accept arguments.\n${usage()}`);
  }

  const config = commandConfig(runtime);
  const issues = validateAdrDirectory(config.directory);

  if (issues.length === 0) {
    runtime.stdout(`ADR validation passed: ${config.directory}`);
    return 0;
  }

  for (const issue of issues) {
    runtime.stderr(formatValidationIssue(issue));
  }
  return 1;
}

function slugCommand(
  runtime: AdrScriptRuntime,
  args: readonly string[],
): number {
  const title = args.join(" ").trim();
  if (!title) {
    throw new Error(`Missing ADR title.\n${usage()}`);
  }

  runtime.stdout(slugifyAdrTitle(title));
  return 0;
}

function filenameCommand(
  runtime: AdrScriptRuntime,
  args: readonly string[],
): number {
  const [rawNumber, ...titleParts] = args;
  const title = titleParts.join(" ").trim();
  const number = Number(rawNumber);

  if (!rawNumber || !title) {
    throw new Error(`Missing ADR number or title.\n${usage()}`);
  }

  runtime.stdout(formatAdrFilename(number, title));
  return 0;
}

export function runAdrScript(
  argv: readonly string[],
  options: RunAdrScriptOptions = {},
): number {
  const [command, ...args] = argv;
  const runtime = runtimeFromOptions(options);

  try {
    switch (command) {
      case undefined:
        runtime.stdout(usage());
        return 0;
      case "init":
        return initAdrDirectory(runtime, args);
      case "new":
        return createNewAdr(runtime, args);
      case "link":
        return linkExistingAdrs(runtime, args);
      case "list":
        return listAdrs(runtime, args);
      case "toc":
        return generateToc(runtime, args);
      case "graph":
        return generateGraph(runtime, args);
      case "validate":
        return validateAdrs(runtime, args);
      case "slug":
        return slugCommand(runtime, args);
      case "filename":
        return filenameCommand(runtime, args);
      default:
        throw new Error(`Unknown command: ${command}\n${usage()}`);
    }
  } catch (error) {
    runtime.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entrypoint) {
  process.exitCode = runAdrScript(process.argv.slice(2));
}
