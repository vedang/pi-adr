#!/usr/bin/env bun

import { pathToFileURL } from "node:url";

function usage(): string {
  return `Usage:
  adr.ts slug <title...>
  adr.ts filename <number> <title...>
`;
}

export function slugifyAdrTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "adr";
}

export function formatAdrFilename(number: number, title: string): string {
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("ADR number must be a positive integer");
  }

  return `${String(number).padStart(4, "0")}-${slugifyAdrTitle(title)}.md`;
}

export function runAdrScript(argv: string[]): number {
  const [command, ...args] = argv;

  if (command === "slug") {
    const title = args.join(" ").trim();
    if (!title) {
      console.error(`Missing ADR title.\n${usage()}`);
      return 1;
    }
    console.log(slugifyAdrTitle(title));
    return 0;
  }

  if (command === "filename") {
    const [rawNumber, ...titleParts] = args;
    const title = titleParts.join(" ").trim();
    const number = Number(rawNumber);

    if (!rawNumber || !title) {
      console.error(`Missing ADR number or title.\n${usage()}`);
      return 1;
    }

    try {
      console.log(formatAdrFilename(number, title));
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  console.log(usage());
  return command ? 1 : 0;
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entrypoint) {
  process.exitCode = runAdrScript(process.argv.slice(2));
}
