#!/usr/bin/env node
// CodeGuard runtime entrypoint. Orchestrates:
//   1. Load the GitAgent definition from disk
//   2. Fetch PR context from GitHub
//   3. Ask Claude to review it
//   4. Post inline comments, a summary, and issues for critical findings
//   5. Set a status check on the PR head commit
//
// Invocation:
//   - GitHub Actions:   node dist/index.js  (reads env from workflow)
//   - Local CLI:        codeguard review --owner X --repo Y --pr 123

import { readFileSync } from "node:fs";
import { loadAgent } from "./loadAgent.js";
import { GitHubClient } from "./github.js";
import { ClaudeReviewer } from "./claude.js";
import type { Finding, ReviewResult } from "./types.js";

interface RunOptions {
  owner: string;
  repo: string;
  prNumber: number;
}

async function main(): Promise<void> {
  const options = resolveOptions();

  console.log(`[codeguard] Reviewing ${options.owner}/${options.repo}#${options.prNumber}`);

  const agent = await loadAgent();
  console.log(`[codeguard] Loaded agent "${agent.name}" v${agent.version} with ${agent.skills.length} skills`);

  const github = new GitHubClient(requireEnv("GITHUB_TOKEN"));
  const claude = new ClaudeReviewer(requireEnv("ANTHROPIC_API_KEY"), agent);

  const pr = await github.getPullRequestContext(
    options.owner,
    options.repo,
    options.prNumber
  );
  console.log(`[codeguard] Fetched PR "${pr.title}" with ${pr.files.length} reviewable files`);

  if (pr.files.length === 0) {
    await github.postSummaryComment(
      options.owner,
      options.repo,
      options.prNumber,
      "### CodeGuard Review\n\nNo reviewable files in this PR. Skipping."
    );
    console.log("[codeguard] Nothing to review. Exiting.");
    return;
  }

  const review = await claude.review(pr);
  console.log(
    `[codeguard] Review complete: ${review.findings.length} findings, verdict=${review.verdict}`
  );

  // Post inline comments via a single review.
  const event = mapVerdictToEvent(review.verdict);
  await github.postReview(
    options.owner,
    options.repo,
    options.prNumber,
    pr.headSha,
    event,
    review.findings
  );

  // Post the summary comment.
  await github.postSummaryComment(
    options.owner,
    options.repo,
    options.prNumber,
    buildSummaryMarkdown(agent.name, agent.version, review)
  );

  // Create issues for every critical finding.
  const criticals = review.findings.filter((f) => f.severity === "critical");
  for (const finding of criticals) {
    try {
      await github.createIssueForFinding(
        options.owner,
        options.repo,
        finding,
        options.prNumber
      );
    } catch (err) {
      console.warn(
        `[codeguard] Failed to create issue for finding "${finding.title}": ${(err as Error).message}`
      );
    }
  }

  // Write an audit log entry (RULES.md rule 13).
  console.log(
    JSON.stringify({
      level: "audit",
      timestamp: new Date().toISOString(),
      agent: `${agent.name}@${agent.version}`,
      model: agent.model.name,
      repo: `${options.owner}/${options.repo}`,
      pr: options.prNumber,
      findings: review.findings.length,
      verdict: review.verdict,
    })
  );

  // Exit non-zero on fail so CI blocks the PR.
  if (review.verdict === "fail") {
    console.error("[codeguard] Verdict is FAIL — exiting 1 to block CI.");
    process.exit(1);
  }
}

function resolveOptions(): RunOptions {
  // Prefer GitHub Actions environment.
  if (process.env.GITHUB_EVENT_PATH) {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const event = JSON.parse(readFileSync(eventPath, "utf-8"));
    const repoFull = process.env.GITHUB_REPOSITORY ?? "";
    const [owner, repo] = repoFull.split("/");
    const prNumber =
      event.pull_request?.number ??
      event.number ??
      parseInt(process.env.PR_NUMBER ?? "0", 10);

    if (!owner || !repo || !prNumber) {
      throw new Error(
        "Could not resolve owner/repo/pr from GitHub Actions environment"
      );
    }
    return { owner, repo, prNumber };
  }

  // Fallback: CLI args — `codeguard review --owner X --repo Y --pr 123`
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const owner = get("--owner") ?? process.env.CG_OWNER;
  const repo = get("--repo") ?? process.env.CG_REPO;
  const prRaw = get("--pr") ?? process.env.CG_PR;

  if (!owner || !repo || !prRaw) {
    throw new Error(
      "Missing arguments. Usage: codeguard review --owner <org> --repo <name> --pr <number>"
    );
  }

  return { owner, repo, prNumber: parseInt(prRaw, 10) };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function mapVerdictToEvent(
  verdict: ReviewResult["verdict"]
): "COMMENT" | "REQUEST_CHANGES" | "APPROVE" {
  if (verdict === "fail") return "REQUEST_CHANGES";
  // We intentionally never APPROVE — humans do that. Warn and pass both use COMMENT.
  return "COMMENT";
}

function buildSummaryMarkdown(
  agentName: string,
  agentVersion: string,
  review: ReviewResult
): string {
  const counts = countBySeverity(review.findings);
  const verdictEmoji =
    review.verdict === "fail"
      ? "🔴 **Changes requested**"
      : review.verdict === "warn"
        ? "🟡 **Review with care**"
        : "🟢 **Looks good**";

  const topThree = review.findings.slice(0, 3);
  const topList =
    topThree.length > 0
      ? topThree
          .map(
            (f, i) =>
              `${i + 1}. **[${f.severity}]** \`${f.file}:${f.line}\` — ${f.title}`
          )
          .join("\n")
      : "_None_";

  return [
    `## ${agentName} Review · v${agentVersion}`,
    "",
    verdictEmoji,
    "",
    `**Findings:** ${counts.critical} critical · ${counts.warning} warning · ${counts.suggestion} suggestion · ${counts.nit} nit`,
    "",
    "### Summary",
    review.summary,
    "",
    "### Top findings",
    topList,
    "",
    "---",
    "_This review was generated by [CodeGuard](https://github.com/open-gitagent/gitagent), a git-native AI PR reviewer._",
    "_CodeGuard is advisory only — humans always make the final merge decision._",
  ].join("\n");
}

function countBySeverity(findings: Finding[]): Record<Finding["severity"], number> {
  const counts = { critical: 0, warning: 0, suggestion: 0, nit: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

main().catch((err: Error) => {
  console.error(`[codeguard] Fatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
