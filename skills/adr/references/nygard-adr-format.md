# Nygard ADR format reference

Read this when drafting or reviewing ADR prose.

## Core purpose

ADRs capture the motivation behind architecturally significant decisions so future maintainers avoid blindly accepting or blindly reversing them. Each ADR records one decision in version-controlled text.

Architecturally significant decisions affect structure, non-functional characteristics, dependencies, interfaces, or construction techniques.

## Standard sections

### Title

Use a short, imperative or noun-phrase title that names the decision.

### Context

Describe forces in tension without taking sides. Good context explains why this decision matters now and what constraints shape the choice.

### Decision

State the choice directly. Prefer active voice, often `We will ...`.

### Status

Record lifecycle state such as `Proposed`, `Accepted`, `Rejected`, or `Superseded`. Superseded records should link to their replacement and remain in history.

### Consequences

Document outcomes of the decision. Include positive, negative, and neutral consequences. Avoid selling the decision as all upside.

## Writing quality rules

- Write for a future developer who has code but not memory of the discussion.
- Use full sentences and paragraphs.
- Use bullets for visual structure, not as a substitute for thinking.
- Keep one decision per ADR.
- Preserve old decisions and link replacements instead of deleting history.
