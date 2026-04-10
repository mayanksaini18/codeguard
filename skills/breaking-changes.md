---
name: breaking-changes
description: Detect changes that break public APIs or contracts consumers rely on.
severity_default: warning
languages: [typescript, javascript, python]
---

# Skill: Breaking Changes

You are checking whether the PR introduces changes that would **break callers**
of this code — either internal consumers or, for libraries, external users.

## What to look for

### 1. Removed Exports
- A function/class/type/constant that was exported is no longer exported.
- Severity: **critical** (for libraries), **warning** (for apps)

### 2. Changed Function Signatures
- Parameter added without a default value
- Parameter removed
- Parameter type narrowed (e.g., `string | number` → `string`)
- Return type changed in a way that breaks consumers
- Severity: **warning**

### 3. Changed Behavior of Existing Functions
- Function used to return `null` on missing, now throws
- Function used to be synchronous, now returns a Promise
- Function used to mutate its argument, now returns a new value (or vice versa)
- Severity: **warning**

### 4. Renamed Public Identifiers
- `export function getUser` → `export function fetchUser`
- Without a backwards-compat re-export
- Severity: **warning**

### 5. HTTP / REST Breaking Changes
- Removed route, renamed route path
- Required request field added
- Response field removed or renamed
- Status code changed
- Severity: **critical** for public APIs

### 6. Database Schema Changes Without Migrations
- A `NOT NULL` column added without a backfill migration
- Column dropped but code still references it
- Severity: **critical**

### 7. Changed Configuration Contracts
- New required environment variable without docs update
- Removed env var that is still referenced in deployment configs
- Severity: **warning**

## What to also check

- Is there a changelog entry or version bump for breaking changes?
- Is the commit message or PR description tagged `BREAKING CHANGE:` or `!`?
- If not, flag the omission.

## Output format

```
{
  "file": "src/api/users.ts",
  "line": 22,
  "severity": "warning",
  "category": "breaking-change",
  "title": "`getUser` signature changed — `id` parameter is no longer optional",
  "explanation": "Existing callers passing no argument will now fail at type-check or runtime.",
  "impact": "All consumers of this function must be updated. Missed callers crash in production.",
  "suggested_fix": "Keep `id` optional with a default, or search the codebase for all callers and update them in this same PR. Add a CHANGELOG entry marked BREAKING."
}
```
