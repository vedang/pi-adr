# adr-tools compatibility reference

Read this before creating files, changing statuses, linking ADRs, or validating existing ADR logs.

## Directory discovery

- Default ADR directory: `doc/adr`.
- Optional project config: `.adr-dir` containing alternate ADR directory path.
- Discovery walks upward from current directory and stops at the nearest `.adr-dir` or `doc/adr`.

## Numbering and filenames

- Filenames use sequential, monotonic, zero-padded numbers: `0001-record-architecture-decisions.md`.
- Headings use human numbers without zero padding: `# 1. Record architecture decisions`.
- Dates use ISO 8601: `YYYY-MM-DD`.
- Slugs are lowercase and replace non-alphanumeric runs with `-`.

## Default template

```markdown
# NUMBER. TITLE

Date: DATE

## Status

STATUS

## Context

## Decision

## Consequences
```

`adr-tools` supports custom templates at `<adr-dir>/templates/template.md`.

## Links and status changes

`adr-tools` link behavior is bidirectional:

- New ADR: `Supercedes [1. Old](0001-old.md)`
- Old ADR: `Superceded by [2. New](0002-new.md)`
- Custom pairs: `Amends`/`Amended by`, `Clarifies`/`Clarified by`

Compatibility rule: parse both historical misspellings (`Supercedes`, `Superceded`) and standard spelling (`Supersedes`, `Superseded`). Prefer standard spelling for new ADRs unless preserving an existing log's style.

## Reports

- Generate Markdown table of contents for ADR lists.
- Generate Graphviz DOT for sequential and relationship edges.
