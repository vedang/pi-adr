# pi-adr

Create and maintain Architecture Decision Records (ADRs) with pi.

`pi-adr` is a skills-first pi package. It exposes the `adr` skill from
`skills/adr/SKILL.md` and keeps ADR guidance, templates, references, and helper
scripts together in that skill bundle.

## Install

Install from a local checkout while developing:

```bash
pi install /absolute/path/to/pi-adr.root
```

Or install from a git source after publishing/tagging:

```bash
pi install git:<repo-url>@<ref>
```

Pi discovers the package through this manifest entry:

```json
{
  "pi": {
    "skills": ["./skills"]
  }
}
```

No prompt template or extension entry point is required for the MVP.

## Use

In pi, load the skill directly:

```text
/skill:adr create "Use PostgreSQL for transactional data"
/skill:adr write an ADR superseding 3 because the cache design changed
/skill:adr review the ADR log and summarize open decisions
```

The skill guides the agent to:

1. locate the ADR directory (`.adr-dir`, then `doc/adr`, then ask before creating a new location),
2. inspect existing ADR style and numbering,
3. draft one decision per ADR using Nygard-style sections,
4. preserve old decisions and supersession history,
5. summarize the created or updated ADR path, status, links, and assumptions.

## Helper commands

Skill-local commands cover deterministic ADR file operations:

```bash
bun run adr init [directory]
bun run adr new [--status STATUS] [--supersedes REF]... [--link "REF:LINK:REVERSE"]... "Use PostgreSQL"
bun run adr link SOURCE LINK TARGET "REVERSE LINK"
bun run adr list
bun run adr toc [--prefix PREFIX]
bun run adr graph [--prefix PREFIX] [--extension EXT]
bun run adr validate
bun run adr slug "Use PostgreSQL for transactional data"
bun run adr filename 1 "Use PostgreSQL for transactional data"
```

Commands print created paths or report content on stdout. Validation errors print
`path[:line]: message` diagnostics on stderr and exit non-zero.

## Package shape

```text
skills/adr/
├── SKILL.md
├── assets/
│   ├── default-template.md
│   └── initial-adr-template.md
├── references/
│   ├── adr-tools-compatibility.md
│   ├── cognitect-documenting-architecture-decisions.md
│   └── nygard-adr-format.md
└── scripts/
    ├── adr.ts
    └── lib/
```

- `SKILL.md` is the primary agent interface.
- `references/` keeps detailed ADR philosophy and compatibility notes out of the
  always-loaded skill text.
- `assets/` stores copyable ADR templates.
- `scripts/` stores deterministic helpers for fragile file operations.

## ADR format and compatibility

`pi-adr` follows Michael Nygard's ADR style:

- one decision per record,
- value-neutral `Context`,
- active-voice `Decision`,
- `Status`,
- positive, negative, and neutral `Consequences`,
- immutable history for superseded or rejected decisions.

It is designed to work with common `adr-tools` conventions:

- default ADR directory: `doc/adr`,
- optional `.adr-dir` file for alternate directories,
- zero-padded monotonic filenames such as
  `0001-record-architecture-decisions.md`,
- headings such as `# 1. Record architecture decisions`,
- ISO dates (`YYYY-MM-DD`),
- Markdown links in status sections.

Compatibility note: old `adr-tools` records may use the historical spellings
`Supercedes` and `Superceded`. Automation parses both spellings and emits
standard `Supersedes`/`Superseded by` status links for new supersession updates.

## Development

Install dependencies:

```bash
bun install
```

Run quality gates:

```bash
make format
make check
make test
make build
```
