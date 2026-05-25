import type { AdrRecord } from "./model";

interface ReportOptions {
  readonly linkPrefix?: string;
  readonly linkExtension?: string;
}

function escapeDotString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function sortByNumber(records: readonly AdrRecord[]): AdrRecord[] {
  return [...records].sort((a, b) => a.number - b.number);
}

function replaceExtension(filename: string, extension: string): string {
  return filename.replace(/\.[^/\\.]+$/, extension);
}

function isForwardRelationship(relationship: string): boolean {
  return !/\sby$/i.test(relationship);
}

export function generateAdrToc(
  records: readonly AdrRecord[],
  options?: ReportOptions,
): string {
  const linkPrefix = options?.linkPrefix ?? "";
  const sorted = sortByNumber(records);

  const lines = sorted.map(
    (record) => `* [${record.title}](${linkPrefix}${record.filename})`,
  );

  return `# Architecture Decision Records\n\n${lines.join("\n")}${
    lines.length > 0 ? "\n" : ""
  }`;
}

export function generateAdrGraph(
  records: readonly AdrRecord[],
  options?: ReportOptions,
): string {
  const linkPrefix = options?.linkPrefix ?? "";
  const linkExtension = options?.linkExtension ?? ".html";

  const sortedRecords = sortByNumber(records);
  const recordNumbers = new Set(sortedRecords.map((record) => record.number));

  const lines: string[] = ["digraph {", "  node [shape=plaintext];"];

  for (const record of sortedRecords) {
    const href = `${linkPrefix}${replaceExtension(record.filename, linkExtension)}`;
    lines.push(
      `  ${record.number} [label="${escapeDotString(`${record.number}. ${record.title}`)}", URL="${escapeDotString(href)}"];`,
    );
  }

  for (let i = 0; i + 1 < sortedRecords.length; i += 1) {
    const sourceNumber = sortedRecords[i].number;
    const targetNumber = sortedRecords[i + 1].number;
    lines.push(
      `  ${sourceNumber} -> ${targetNumber} [style=dotted, weight=1];`,
    );
  }
  const addedEdges = new Set<string>();

  for (const sourceRecord of sortedRecords) {
    for (const link of sourceRecord.links) {
      const relationship = link.relationship;
      if (!isForwardRelationship(relationship)) {
        continue;
      }

      const targetNumber = link.targetNumber;
      if (targetNumber === undefined || !recordNumbers.has(targetNumber)) {
        continue;
      }

      const edge = `${sourceRecord.number}->${targetNumber}:${relationship}`;
      if (addedEdges.has(edge)) {
        continue;
      }
      addedEdges.add(edge);

      lines.push(
        `  ${sourceRecord.number} -> ${targetNumber} [label="${escapeDotString(relationship)}", weight=0];`,
      );
    }
  }

  lines.push("}");

  return `${lines.join("\n")}\n`;
}
