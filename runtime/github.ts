// Thin Octokit wrapper. The LLM never touches this file directly — only the
// orchestrator in index.ts uses these helpers.

import { Octokit } from "@octokit/rest";
import type { ChangedFile, Finding, PRContext } from "./types.js";

const IGNORED_PATH_PATTERNS = [
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^coverage\//,
  /\.min\.js$/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/,
  /__snapshots__\//,
];

const REVIEWABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
];

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    if (!token) {
      throw new Error(
        "GITHUB_TOKEN is required. Pass it via env or GitHub Actions secret."
      );
    }
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequestContext(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<PRContext> {
    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    const files = await this.getChangedFiles(owner, repo, pullNumber);

    return {
      owner,
      repo,
      number: pullNumber,
      title: pr.title,
      body: pr.body ?? "",
      author: pr.user?.login ?? "unknown",
      headSha: pr.head.sha,
      baseSha: pr.base.sha,
      files,
    };
  }

  async getChangedFiles(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<ChangedFile[]> {
    const files = await this.octokit.paginate(this.octokit.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    return files
      .filter((f) => !IGNORED_PATH_PATTERNS.some((rx) => rx.test(f.filename)))
      .filter((f) =>
        REVIEWABLE_EXTENSIONS.some((ext) => f.filename.endsWith(ext))
      )
      .map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      }));
  }

  async postSummaryComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string
  ): Promise<void> {
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
  }

  async postReview(
    owner: string,
    repo: string,
    pullNumber: number,
    commitId: string,
    event: "COMMENT" | "REQUEST_CHANGES" | "APPROVE",
    findings: Finding[]
  ): Promise<void> {
    const comments = findings
      .filter((f) => f.line > 0)
      .slice(0, 15)
      .map((f) => ({
        path: f.file,
        line: f.line,
        side: "RIGHT" as const,
        body: formatInlineComment(f),
      }));

    // Always post at least an event, even when no inline comments survived.
    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitId,
      event,
      comments: comments.length > 0 ? comments : undefined,
      body:
        comments.length === 0
          ? "CodeGuard review complete — see summary comment for details."
          : undefined,
    });
  }

  async createIssueForFinding(
    owner: string,
    repo: string,
    finding: Finding,
    prNumber: number
  ): Promise<void> {
    const title = `[CodeGuard] ${finding.title}`;
    const body = [
      `**Severity:** ${finding.severity}`,
      `**Category:** ${finding.category}`,
      `**File:** \`${finding.file}:${finding.line}\``,
      `**Discovered in:** #${prNumber}`,
      "",
      "### Explanation",
      finding.explanation,
      "",
      "### Impact",
      finding.impact,
      "",
      "### Suggested fix",
      finding.suggested_fix,
      "",
      "---",
      "_Opened automatically by [CodeGuard](https://github.com/open-gitagent/gitagent)._",
    ].join("\n");

    await this.octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels: ["codeguard", `severity:${finding.severity}`, finding.category],
    });
  }
}

function formatInlineComment(f: Finding): string {
  const icon =
    f.severity === "critical"
      ? "🔴"
      : f.severity === "warning"
        ? "🟡"
        : f.severity === "suggestion"
          ? "💡"
          : "·";
  return [
    `${icon} **[${f.severity}] ${f.title}**`,
    "",
    f.explanation,
    "",
    `**Why it matters:** ${f.impact}`,
    "",
    "**Suggested fix:**",
    f.suggested_fix,
    "",
    `_CodeGuard · ${f.category}_`,
  ].join("\n");
}
