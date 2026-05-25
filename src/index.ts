import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Placeholder extension entry point for the pi-adr package.
 *
 * The primary workflow lives in the bundled `skills/adr` Agent Skill so humans
 * and agents can use the ADR guidance, references, templates, and scripts
 * without relying on a slash prompt.
 */
export default function adrExtension(_pi: ExtensionAPI): void {
  // Intentionally idle until ADR automation is implemented.
}
