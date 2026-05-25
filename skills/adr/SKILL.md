---
name: adr
description: Create, review, update, query, and maintain Architecture Decision Records (ADRs). Use when the user asks to create an ADR, write a decision record, document architecture rationale, supersede, amend, clarify, list, validate, summarize, or generate reports for ADRs. Also use when a repository has doc/adr, .adr-dir, or numbered ADR markdown files. Do not use for generic docs or meeting notes unless an architectural decision record is requested.
---

# ADR

Use this skill to help humans and agents create maintainable Architecture Decision Records.

## When to load resources

| Need | Resource |
| --- | --- |
| ADR prose guidance | `references/nygard-adr-format.md` |
| Existing adr-tools logs | `references/adr-tools-compatibility.md` |
| Original source article | `references/cognitect-documenting-architecture-decisions.md` |
| Copyable templates | `assets/default-template.md`, `assets/initial-adr-template.md` |
| Safe ADR file operations | `bun run adr init/new/link/list/toc/graph/validate/slug/filename ...` from package root |

## Workflow

1. Determine intent: create first ADR, create new ADR, supersede/amend/clarify an ADR, list/summarize decisions, validate ADRs, or generate reports.
2. Locate ADR directory using existing project convention: `.adr-dir` wins, then `doc/adr`, then ask before creating a new location.
3. Inspect existing ADRs for numbering, status style, templates, and spelling conventions.
4. For new ADRs, capture one decision only. Ask at most 1-3 clarifying questions when context, decision, status, or consequences are unclear.
5. Use `bun run adr ...` for deterministic init, create, link, list, report, validate, slug, and filename operations. Inspect generated prose and status links before summarizing.
6. Summarize path, title, status, links, and assumptions after writing or updating ADRs.

## Writing rules

- Write for future maintainers who need motivation, not only outcome.
- Use full sentences. Bullets help structure, but cannot replace reasoning.
- Keep `Context` value-neutral: describe forces in tension.
- Write `Decision` in active voice, usually `We will ...`.
- Include positive, negative, and neutral `Consequences`.
- Preserve superseded/rejected decisions; never delete rationale history.

## Helper commands

```bash
# From package root
bun run adr init [directory]
bun run adr new [--status STATUS] [--supersedes REF]... [--link "REF:LINK:REVERSE"]... "Use PostgreSQL"
bun run adr link SOURCE LINK TARGET "REVERSE LINK"
bun run adr list
bun run adr toc [--prefix PREFIX]
bun run adr graph [--prefix PREFIX] [--extension EXT]
bun run adr validate
bun run adr slug "Use PostgreSQL for transactional data"
bun run adr filename 1 "Use PostgreSQL for transactional data"

# From this skill directory
bun run scripts/adr.ts validate
```
