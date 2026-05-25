export const DEFAULT_ADR_DIRECTORY = "doc/adr";
export const DEFAULT_ADR_STATUS = "Accepted";

export const ADR_STATUS_VALUES = [
  "Proposed",
  "Accepted",
  "Rejected",
  "Deprecated",
  "Superseded",
] as const;

export type AdrStatus = (typeof ADR_STATUS_VALUES)[number];

export const ADR_LINK_RELATIONSHIPS = {
  supersedes: {
    forward: "Supersedes",
    reverse: "Superseded by",
  },
  amends: {
    forward: "Amends",
    reverse: "Amended by",
  },
  clarifies: {
    forward: "Clarifies",
    reverse: "Clarified by",
  },
} as const;

export const ADR_TOOLS_COMPAT_LINK_RELATIONSHIPS = {
  supercedes: {
    forward: "Supercedes",
    reverse: "Superceded by",
  },
} as const;

export type AdrLinkRelationship =
  | keyof typeof ADR_LINK_RELATIONSHIPS
  | keyof typeof ADR_TOOLS_COMPAT_LINK_RELATIONSHIPS;

export type AdrLinkDirection = "forward" | "reverse";

export interface AdrLink {
  readonly relationship: string;
  readonly targetHref: string;
  readonly targetNumber?: number;
  readonly targetTitle?: string;
  readonly rawMarkdown: string;
}

export interface AdrRecord {
  readonly number: number;
  readonly title: string;
  readonly filename: string;
  readonly filePath: string;
  readonly date: string | null;
  readonly status: AdrStatus | null;
  readonly statusText: string;
  readonly links: readonly AdrLink[];
  readonly rawContent: string;
}

export interface AdrRepositoryConfig {
  readonly cwd: string;
  readonly directory: string;
  readonly configFilePath?: string;
  readonly templatePath?: string;
  readonly defaultStatus: AdrStatus;
}

export const ADR_TEMPLATE_PLACEHOLDERS = [
  "NUMBER",
  "TITLE",
  "DATE",
  "STATUS",
] as const;

export type AdrTemplatePlaceholder = (typeof ADR_TEMPLATE_PLACEHOLDERS)[number];
export type AdrTemplateValues = Record<AdrTemplatePlaceholder, string>;
