export const FALLBACK_ADR_SLUG = "adr";

export function slugifyAdrTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || FALLBACK_ADR_SLUG;
}

export function formatAdrFilename(number: number, title: string): string {
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("ADR number must be a positive integer");
  }

  return `${String(number).padStart(4, "0")}-${slugifyAdrTitle(title)}.md`;
}
