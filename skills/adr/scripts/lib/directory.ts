import { type Stats, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { DEFAULT_ADR_DIRECTORY, DEFAULT_ADR_STATUS } from "./model";
import type { AdrRepositoryConfig } from "./model";

const ADR_DIR_MARKER = ".adr-dir";
const REPOSITORY_MARKERS = [".git", ".jj", "package.json"] as const;

const MISSING_PATH_ERROR_CODES = new Set(["ENOENT", "ENOTDIR"]);

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    MISSING_PATH_ERROR_CODES.has(error.code)
  );
}

function statPath(filePath: string): Stats | null {
  try {
    return statSync(filePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }
    throw error;
  }
}

function readAdrDirMarker(configFilePath: string): string {
  const adrDirectory = readFileSync(configFilePath, "utf8").trim();
  if (!adrDirectory) {
    throw new Error(".adr-dir must contain an ADR directory path");
  }
  if (adrDirectory.includes("\0")) {
    throw new Error(".adr-dir must not contain null bytes");
  }
  return adrDirectory;
}

function hasRepositoryMarker(directory: string): boolean {
  return REPOSITORY_MARKERS.some(
    (marker) => statPath(path.join(directory, marker)) !== null,
  );
}

export function discoverAdrRepositoryConfig(
  cwd = process.cwd(),
): AdrRepositoryConfig {
  const startDirectory = path.resolve(cwd);
  let currentDirectory = startDirectory;
  let repositoryRoot: string | undefined;

  while (true) {
    const configFilePath = path.join(currentDirectory, ADR_DIR_MARKER);
    if (statPath(configFilePath)?.isFile()) {
      const adrDirectory = readAdrDirMarker(configFilePath);
      return {
        cwd: startDirectory,
        directory: path.resolve(currentDirectory, adrDirectory),
        configFilePath,
        defaultStatus: DEFAULT_ADR_STATUS,
      } satisfies AdrRepositoryConfig;
    }

    const candidateDirectory = path.join(
      currentDirectory,
      DEFAULT_ADR_DIRECTORY,
    );
    if (statPath(candidateDirectory)?.isDirectory()) {
      return {
        cwd: startDirectory,
        directory: candidateDirectory,
        defaultStatus: DEFAULT_ADR_STATUS,
      } satisfies AdrRepositoryConfig;
    }

    if (!repositoryRoot && hasRepositoryMarker(currentDirectory)) {
      repositoryRoot = currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
  }

  return {
    cwd: startDirectory,
    directory: path.join(
      repositoryRoot ?? startDirectory,
      DEFAULT_ADR_DIRECTORY,
    ),
    defaultStatus: DEFAULT_ADR_STATUS,
  } satisfies AdrRepositoryConfig;
}
