// Shared types used across the CodeGuard runtime.

export type Severity = "critical" | "warning" | "suggestion" | "nit";

export type FindingCategory =
  | "security"
  | "test-coverage"
  | "quality"
  | "breaking-change";

export interface Finding {
  file: string;
  line: number;
  severity: Severity;
  category: FindingCategory;
  title: string;
  explanation: string;
  impact: string;
  suggested_fix: string;
}

export interface ReviewResult {
  findings: Finding[];
  summary: string;
  verdict: "pass" | "warn" | "fail";
}

export interface AgentDefinition {
  name: string;
  version: string;
  description: string;
  soul: string;
  rules: string;
  skills: Array<{ name: string; body: string }>;
  model: {
    provider: string;
    name: string;
    temperature: number;
    max_tokens: number;
  };
}

export interface PRContext {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  author: string;
  headSha: string;
  baseSha: string;
  files: ChangedFile[];
}

export interface ChangedFile {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed" | string;
  additions: number;
  deletions: number;
  patch?: string;
}
