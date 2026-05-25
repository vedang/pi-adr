import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runAdrScript } from "../../skills/adr/scripts/adr";

const TEST_DATE = "2026-05-25";
const DEFAULT_ADR_DIRECTORY = "doc/adr";
const ALTERNATIVE_ADR_DIRECTORY = "architecture/decisions";
const INITIAL_ADR_TITLE = "Record architecture decisions";
const INITIAL_ADR_FILENAME = "0001-record-architecture-decisions.md";
const INITIAL_ADR_CASE = {
  number: 1,
  title: INITIAL_ADR_TITLE,
  filename: INITIAL_ADR_FILENAME,
} as const;
const PROJECT_ADR_TEMPLATE = `# NUMBER. TITLE

Date: DATE

## Status

STATUS

## Context

Describe project-specific forces here.

## Decision

Describe the project-specific decision here.

## Consequences

Describe project-specific outcomes here.
`;
const EXPECTED_INITIAL_ADR = `# ${INITIAL_ADR_CASE.number}. ${INITIAL_ADR_CASE.title}

Date: ${TEST_DATE}

## Status

Accepted

## Context

The project needs a lightweight way to preserve important architecture decisions and the forces that shaped them.

## Decision

We will record architecture decisions as numbered Markdown files in version control.

## Consequences

Future maintainers can understand why decisions were made. The project gains a small documentation maintenance obligation. Superseded decisions remain available as historical context.
`;
interface DefaultAdrCase {
  readonly number: number;
  readonly title: string;
  readonly filename: string;
}

const USE_POSTGRESQL_ADR = {
  number: 2,
  title: "Use PostgreSQL",
  filename: "0002-use-postgresql.md",
} as const;
const USE_MYSQL_ADR = {
  number: 2,
  title: "Use MySQL",
  filename: "0002-use-mysql.md",
} as const;
const USE_POSTGRESQL_REPLACEMENT_ADR = {
  number: 3,
  title: "Use PostgreSQL",
  filename: "0003-use-postgresql.md",
} as const;
const NEW_ADR_CASES = [
  USE_POSTGRESQL_ADR,
  {
    number: 3,
    title: "Use Redis for cache",
    filename: "0003-use-redis-for-cache.md",
  },
] as const;
const FUNNY_TITLE_CASES = [
  {
    number: 2,
    title: "Something About Node.JS",
    filename: "0002-something-about-node-js.md",
  },
  {
    number: 3,
    title: "Slash/Slash/Slash/",
    filename: "0003-slash-slash-slash.md",
  },
  {
    number: 4,
    title: '"-Bar-"',
    filename: "0004-bar.md",
  },
] as const;
const OCTAL_NUMBER_ADR_CASES = Array.from({ length: 9 }, (_, index) => {
  const number = index + 2;
  const paddedNumber = String(number).padStart(4, "0");

  return {
    number,
    title: `Decision ${number}`,
    filename: `${paddedNumber}-decision-${number}.md`,
  };
});
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pi-adr-workflow-"));
  tempRoots.push(root);
  return root;
}

function adrPath(
  root: string,
  filename: string,
  directory = DEFAULT_ADR_DIRECTORY,
): string {
  return path.join(root, directory, filename);
}

function initialAdrPath(
  root: string,
  directory = DEFAULT_ADR_DIRECTORY,
): string {
  return adrPath(root, INITIAL_ADR_FILENAME, directory);
}

function expectedDefaultAdr(number: number, title: string): string {
  return `# ${number}. ${title}

Date: ${TEST_DATE}

## Status

Accepted

## Context

## Decision

## Consequences
`;
}

function expectedProjectTemplateAdr(number: number, title: string): string {
  return PROJECT_ADR_TEMPLATE.replace("NUMBER", String(number))
    .replace("TITLE", title)
    .replace("DATE", TEST_DATE)
    .replace("STATUS", "Accepted");
}

function expectedDefaultAdrSuperseding(
  number: number,
  title: string,
  supersededAdrs: readonly DefaultAdrCase[],
): string {
  const statusLinks = supersededAdrs
    .map(
      (supersededAdr) =>
        `Supersedes [${supersededAdr.number}. ${supersededAdr.title}](${supersededAdr.filename})`,
    )
    .join("\n\n");

  return `# ${number}. ${title}

Date: ${TEST_DATE}

## Status

Accepted

${statusLinks}

## Context

## Decision

## Consequences
`;
}

function expectedAdrWithStatusLink(content: string, linkLine: string): string {
  return content.replace(
    "\nAccepted\n\n## Context",
    `\nAccepted\n\n${linkLine}\n\n## Context`,
  );
}

function expectedStatusLink(
  relationship: string,
  targetAdr: DefaultAdrCase,
): string {
  return `${relationship} [${targetAdr.number}. ${targetAdr.title}](${targetAdr.filename})`;
}

function expectedDefaultAdrWithStatusLink(
  sourceAdr: DefaultAdrCase,
  relationship: string,
  targetAdr: DefaultAdrCase,
): string {
  return expectedAdrWithStatusLink(
    expectedDefaultAdr(sourceAdr.number, sourceAdr.title),
    expectedStatusLink(relationship, targetAdr),
  );
}

function expectedInitialAdrWithStatusLink(
  relationship: string,
  targetAdr: DefaultAdrCase,
): string {
  return expectedAdrWithStatusLink(
    EXPECTED_INITIAL_ADR,
    expectedStatusLink(relationship, targetAdr),
  );
}

function expectedAdrSupersededBy(
  content: string,
  replacementAdr: DefaultAdrCase,
): string {
  return content.replace(
    "Accepted",
    `Superseded by [${replacementAdr.number}. ${replacementAdr.title}](${replacementAdr.filename})`,
  );
}

function expectedInitialAdrSupersededBy(
  replacementAdr: DefaultAdrCase,
): string {
  return expectedAdrSupersededBy(EXPECTED_INITIAL_ADR, replacementAdr);
}

function expectedDefaultAdrSupersededBy(
  supersededAdr: DefaultAdrCase,
  replacementAdr: DefaultAdrCase,
): string {
  return expectedAdrSupersededBy(
    expectedDefaultAdr(supersededAdr.number, supersededAdr.title),
    replacementAdr,
  );
}

function expectedListRow(
  { number, filename, title }: DefaultAdrCase,
  status = "Accepted",
): string {
  return [number, status, filename, title].join("\t");
}

function expectedListRows(cases: readonly DefaultAdrCase[]): string[] {
  return [
    expectedListRow(INITIAL_ADR_CASE),
    ...cases.map((adrCase) => expectedListRow(adrCase)),
  ];
}

interface GraphRelationshipCase {
  readonly source: DefaultAdrCase;
  readonly relationship: string;
  readonly target: DefaultAdrCase;
}

function expectedTableOfContents(cases: readonly DefaultAdrCase[]): string {
  const lines = [INITIAL_ADR_CASE, ...cases].map(
    ({ filename, title }) => `* [${title}](${filename})`,
  );

  return `# Architecture Decision Records\n\n${lines.join("\n")}\n`;
}

function expectedGraph(
  cases: readonly DefaultAdrCase[],
  relationships: readonly GraphRelationshipCase[] = [],
): string {
  const records = [INITIAL_ADR_CASE, ...cases];
  const lines = ["digraph {", "  node [shape=plaintext];"];

  for (const { number, title, filename } of records) {
    lines.push(
      `  ${number} [label="${number}. ${title}", URL="${filename.replace(".md", ".html")}"];`,
    );
  }

  for (let index = 0; index + 1 < records.length; index += 1) {
    lines.push(
      `  ${records[index].number} -> ${records[index + 1].number} [style=dotted, weight=1];`,
    );
  }

  for (const { source, relationship, target } of relationships) {
    lines.push(
      `  ${source.number} -> ${target.number} [label="${relationship}", weight=0];`,
    );
  }

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function expectDefaultAdrCreation(
  root: string,
  cases: readonly DefaultAdrCase[],
  directory = DEFAULT_ADR_DIRECTORY,
): void {
  for (const { number, title, filename } of cases) {
    const filePath = adrPath(root, filename, directory);

    expect(runScript(root, ["new", title])).toEqual({
      code: 0,
      stdout: [filePath],
      stderr: [],
    });
    expect(readFileSync(filePath, "utf8")).toBe(
      expectedDefaultAdr(number, title),
    );
  }
}

function createDefaultAdrWorkflow(cases: readonly DefaultAdrCase[]): string {
  const root = makeTempRoot();

  expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
  expectDefaultAdrCreation(root, cases);

  return root;
}

function expectDefaultAdrWorkflow(cases: readonly DefaultAdrCase[]): void {
  const root = createDefaultAdrWorkflow(cases);

  expect(runScript(root, ["list"])).toEqual({
    code: 0,
    stdout: expectedListRows(cases),
    stderr: [],
  });
}

function supersedesOptions(cases: readonly DefaultAdrCase[]): string[] {
  return cases.flatMap((adrCase) => ["--supersedes", String(adrCase.number)]);
}

function writeProjectAdrTemplate(root: string): void {
  const templatePath = path.join(
    root,
    DEFAULT_ADR_DIRECTORY,
    "templates",
    "template.md",
  );

  mkdirSync(path.dirname(templatePath), { recursive: true });
  writeFileSync(templatePath, PROJECT_ADR_TEMPLATE);
}

function expectAlternativeAdrDirectoryInitialized(root: string): void {
  const initialPath = initialAdrPath(root, ALTERNATIVE_ADR_DIRECTORY);

  expect(runScript(root, ["init", ALTERNATIVE_ADR_DIRECTORY])).toEqual({
    code: 0,
    stdout: [initialPath],
    stderr: [],
  });
  expect(readFileSync(path.join(root, ".adr-dir"), "utf8")).toBe(
    `${ALTERNATIVE_ADR_DIRECTORY}\n`,
  );
  expect(existsSync(path.join(root, DEFAULT_ADR_DIRECTORY))).toBe(false);
  expect(readFileSync(initialPath, "utf8")).toBe(EXPECTED_INITIAL_ADR);
}

function expectPostgresqlAmendsInitial(root: string): void {
  expect(readFileSync(adrPath(root, USE_POSTGRESQL_ADR.filename), "utf8")).toBe(
    expectedDefaultAdrWithStatusLink(
      USE_POSTGRESQL_ADR,
      "Amends",
      INITIAL_ADR_CASE,
    ),
  );
  expect(readFileSync(initialAdrPath(root), "utf8")).toBe(
    expectedInitialAdrWithStatusLink("Amended by", USE_POSTGRESQL_ADR),
  );
  expect(runScript(root, ["list"])).toEqual({
    code: 0,
    stdout: expectedListRows([USE_POSTGRESQL_ADR]),
    stderr: [],
  });
  expect(runScript(root, ["validate"])).toEqual({
    code: 0,
    stdout: [
      `ADR validation passed: ${path.join(root, DEFAULT_ADR_DIRECTORY)}`,
    ],
    stderr: [],
  });
}

function runScript(
  cwd: string,
  argv: readonly string[],
): {
  readonly code: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = runAdrScript([...argv], {
    cwd,
    date: TEST_DATE,
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  });

  return { code, stdout, stderr };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ADR workflows", () => {
  it("creates the first record", () => {
    const root = makeTempRoot();
    const adrPath = initialAdrPath(root);

    expect(runScript(root, ["init"])).toEqual({
      code: 0,
      stdout: [adrPath],
      stderr: [],
    });
    expect(existsSync(path.join(root, ".adr-dir"))).toBe(false);
    expect(readFileSync(adrPath, "utf8")).toBe(EXPECTED_INITIAL_ADR);
  });

  it("creates multiple records with monotonic numbering", () => {
    expectDefaultAdrWorkflow(NEW_ADR_CASES);
  });

  it("creates records in an alternative ADR directory", () => {
    const root = makeTempRoot();

    expectAlternativeAdrDirectoryInitialized(root);
    expectDefaultAdrCreation(
      root,
      [USE_POSTGRESQL_ADR],
      ALTERNATIVE_ADR_DIRECTORY,
    );
    expect(runScript(root, ["list"])).toEqual({
      code: 0,
      stdout: expectedListRows([USE_POSTGRESQL_ADR]),
      stderr: [],
    });
  });

  it("uses a project-specific template for new records", () => {
    const root = makeTempRoot();
    const createdAdrPath = adrPath(root, USE_POSTGRESQL_ADR.filename);

    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
    writeProjectAdrTemplate(root);

    expect(runScript(root, ["new", USE_POSTGRESQL_ADR.title])).toEqual({
      code: 0,
      stdout: [createdAdrPath],
      stderr: [],
    });
    expect(readFileSync(createdAdrPath, "utf8")).toBe(
      expectedProjectTemplateAdr(
        USE_POSTGRESQL_ADR.number,
        USE_POSTGRESQL_ADR.title,
      ),
    );
    expect(runScript(root, ["list"])).toEqual({
      code: 0,
      stdout: expectedListRows([USE_POSTGRESQL_ADR]),
      stderr: [],
    });
  });

  it("supersedes an existing ADR during record creation", () => {
    const root = makeTempRoot();
    const supersededAdrs = [INITIAL_ADR_CASE] as const;
    const createdAdrPath = adrPath(root, USE_POSTGRESQL_ADR.filename);

    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });

    expect(
      runScript(root, [
        "new",
        ...supersedesOptions(supersededAdrs),
        USE_POSTGRESQL_ADR.title,
      ]),
    ).toEqual({
      code: 0,
      stdout: [createdAdrPath],
      stderr: [],
    });
    expect(readFileSync(initialAdrPath(root), "utf8")).toBe(
      expectedInitialAdrSupersededBy(USE_POSTGRESQL_ADR),
    );
    expect(readFileSync(createdAdrPath, "utf8")).toBe(
      expectedDefaultAdrSuperseding(
        USE_POSTGRESQL_ADR.number,
        USE_POSTGRESQL_ADR.title,
        supersededAdrs,
      ),
    );
    expect(runScript(root, ["list"])).toEqual({
      code: 0,
      stdout: [
        ...supersededAdrs.map((adrCase) =>
          expectedListRow(adrCase, "Superseded"),
        ),
        expectedListRow(USE_POSTGRESQL_ADR),
      ],
      stderr: [],
    });
  });

  it("supersedes multiple ADRs during record creation", () => {
    const root = makeTempRoot();
    const supersededAdrs = [INITIAL_ADR_CASE, USE_MYSQL_ADR] as const;
    const createdAdrPath = adrPath(
      root,
      USE_POSTGRESQL_REPLACEMENT_ADR.filename,
    );

    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
    expectDefaultAdrCreation(root, [USE_MYSQL_ADR]);

    expect(
      runScript(root, [
        "new",
        ...supersedesOptions(supersededAdrs),
        USE_POSTGRESQL_REPLACEMENT_ADR.title,
      ]),
    ).toEqual({
      code: 0,
      stdout: [createdAdrPath],
      stderr: [],
    });
    expect(readFileSync(initialAdrPath(root), "utf8")).toBe(
      expectedInitialAdrSupersededBy(USE_POSTGRESQL_REPLACEMENT_ADR),
    );
    expect(readFileSync(adrPath(root, USE_MYSQL_ADR.filename), "utf8")).toBe(
      expectedDefaultAdrSupersededBy(
        USE_MYSQL_ADR,
        USE_POSTGRESQL_REPLACEMENT_ADR,
      ),
    );
    expect(readFileSync(createdAdrPath, "utf8")).toBe(
      expectedDefaultAdrSuperseding(
        USE_POSTGRESQL_REPLACEMENT_ADR.number,
        USE_POSTGRESQL_REPLACEMENT_ADR.title,
        supersededAdrs,
      ),
    );
    expect(runScript(root, ["list"])).toEqual({
      code: 0,
      stdout: [
        ...supersededAdrs.map((adrCase) =>
          expectedListRow(adrCase, "Superseded"),
        ),
        expectedListRow(USE_POSTGRESQL_REPLACEMENT_ADR),
      ],
      stderr: [],
    });
  });

  it("links existing ADRs bidirectionally", () => {
    const root = makeTempRoot();

    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
    expectDefaultAdrCreation(root, [USE_POSTGRESQL_ADR]);

    expect(
      runScript(root, [
        "link",
        String(USE_POSTGRESQL_ADR.number),
        "Amends",
        String(INITIAL_ADR_CASE.number),
        "Amended by",
      ]),
    ).toEqual({
      code: 0,
      stdout: [
        `${USE_POSTGRESQL_ADR.filename} Amends ${INITIAL_ADR_CASE.filename}`,
      ],
      stderr: [],
    });
    expectPostgresqlAmendsInitial(root);
  });

  it("links a new ADR during record creation", () => {
    const root = makeTempRoot();
    const createdAdrPath = adrPath(root, USE_POSTGRESQL_ADR.filename);

    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });

    expect(
      runScript(root, [
        "new",
        "--link",
        `${INITIAL_ADR_CASE.number}:Amends:Amended by`,
        USE_POSTGRESQL_ADR.title,
      ]),
    ).toEqual({
      code: 0,
      stdout: [createdAdrPath],
      stderr: [],
    });
    expectPostgresqlAmendsInitial(root);
  });

  it("generates Markdown contents for the ADR log", () => {
    const root = createDefaultAdrWorkflow(NEW_ADR_CASES);

    expect(runScript(root, ["toc"])).toEqual({
      code: 0,
      stdout: [expectedTableOfContents(NEW_ADR_CASES)],
      stderr: [],
    });
  });

  it("generates a Graphviz graph for the ADR log", () => {
    const root = createDefaultAdrWorkflow([USE_POSTGRESQL_ADR]);

    expect(
      runScript(root, [
        "link",
        String(USE_POSTGRESQL_ADR.number),
        "Amends",
        String(INITIAL_ADR_CASE.number),
        "Amended by",
      ]),
    ).toMatchObject({ code: 0 });
    expect(runScript(root, ["graph"])).toEqual({
      code: 0,
      stdout: [
        expectedGraph(
          [USE_POSTGRESQL_ADR],
          [
            {
              source: USE_POSTGRESQL_ADR,
              relationship: "Amends",
              target: INITIAL_ADR_CASE,
            },
          ],
        ),
      ],
      stderr: [],
    });
  });

  it("finds a custom ADR directory from nested working directories", () => {
    const root = makeTempRoot();
    const nestedDirectory = path.join(root, "src", "app", "feature");
    const createdAdrPath = adrPath(
      root,
      USE_POSTGRESQL_ADR.filename,
      ALTERNATIVE_ADR_DIRECTORY,
    );

    mkdirSync(nestedDirectory, { recursive: true });

    expectAlternativeAdrDirectoryInitialized(root);
    expect(
      runScript(nestedDirectory, ["new", USE_POSTGRESQL_ADR.title]),
    ).toEqual({
      code: 0,
      stdout: [createdAdrPath],
      stderr: [],
    });
    expect(readFileSync(createdAdrPath, "utf8")).toBe(
      expectedDefaultAdr(USE_POSTGRESQL_ADR.number, USE_POSTGRESQL_ADR.title),
    );
    expect(existsSync(path.join(nestedDirectory, DEFAULT_ADR_DIRECTORY))).toBe(
      false,
    );
    expect(runScript(nestedDirectory, ["list"])).toEqual({
      code: 0,
      stdout: expectedListRows([USE_POSTGRESQL_ADR]),
      stderr: [],
    });
  });

  it("slugifies funny title characters during record creation", () => {
    expectDefaultAdrWorkflow(FUNNY_TITLE_CASES);
  });

  it("avoids treating padded ADR numbers as octal", () => {
    expectDefaultAdrWorkflow(OCTAL_NUMBER_ADR_CASES);
  });

  it("requires a title when creating a new ADR", () => {
    const root = makeTempRoot();

    expect(runScript(root, ["init"])).toMatchObject({ code: 0 });
    expect(runScript(root, ["new"])).toEqual({
      code: 1,
      stdout: [],
      stderr: ["Missing ADR title."],
    });
    expect(existsSync(adrPath(root, "0002-.md"))).toBe(false);
    expect(runScript(root, ["list"])).toEqual({
      code: 0,
      stdout: [expectedListRow(INITIAL_ADR_CASE)],
      stderr: [],
    });
  });
});
