---
name: github-pr
description: Tool for reading PR metadata/diffs and writing PR comments, reviews, and issues via the GitHub REST API.
runtime: node
sdk: "@octokit/rest"
---

# Tool: github-pr

This tool is the bridge between CodeGuard and the GitHub REST API. It is used
by the runtime (`runtime/index.ts`) — the LLM itself never calls the API
directly.

## Capabilities

| Method | Purpose |
|--------|---------|
| `getPullRequest(owner, repo, pr)` | Fetch PR metadata (title, body, author, head/base SHA) |
| `getChangedFiles(owner, repo, pr)` | List files changed with filename, status, patch |
| `postSummaryComment(owner, repo, pr, body)` | Post a single summary comment at the top of the PR |
| `postReview(owner, repo, pr, event, comments)` | Post an inline review with per-line comments. `event` ∈ { `COMMENT`, `REQUEST_CHANGES`, `APPROVE` } |
| `createIssue(owner, repo, title, body, labels)` | Create a GitHub issue for a `critical` finding |
| `setStatusCheck(owner, repo, sha, state, description)` | Set a pass/warn/fail check on the PR head commit |

## Authentication

The tool expects a `GITHUB_TOKEN` environment variable with these scopes:

- `pull_requests: write`
- `issues: write`
- `checks: write`
- `contents: read`

Inside GitHub Actions, the built-in `${{ secrets.GITHUB_TOKEN }}` is sufficient
when the workflow declares the matching permissions.

## Rate Limits

CodeGuard batches all comments into a single `postReview` call (one API call
for up to 15 comments). Combined with 1 summary comment and 0–N issues, a full
review is typically 2–5 API calls.

## Failure Modes

- If `GITHUB_TOKEN` is missing → hard fail at startup
- If the PR is closed or merged while review is in progress → skip posting,
  log and exit 0
- If the GitHub API returns a 403/404 → log, do not retry, exit 1
- If the LLM produces malformed JSON → retry once with a stricter prompt,
  then fall back to posting a summary comment without inline comments
