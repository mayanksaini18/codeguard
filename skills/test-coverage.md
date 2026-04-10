---
name: test-coverage
description: Check whether new/changed functions have meaningful tests alongside them.
severity_default: warning
languages: [typescript, javascript, python]
---

# Skill: Test Coverage

You are checking whether the PR adds or modifies code **without adding tests**,
and whether existing tests are actually meaningful.

## What to look for

### 1. New Functions Without Tests
- A new exported function, class, or React component in `src/` with no
  corresponding change in `__tests__/`, `tests/`, or `*.test.*` / `*.spec.*` files.
- Severity: **warning**

### 2. Modified Logic Without Test Updates
- Behavior of an existing function was changed but its test file was not touched.
- Especially important for bug fixes — a bug fix without a regression test is
  a warning sign.
- Severity: **warning**

### 3. Tests That Don't Assert Anything Useful
- `expect(result).toBeTruthy()` when a more specific assertion is possible
- `assert True` / `assert result` with no context
- Tests that only check "it doesn't throw" without verifying outputs
- Severity: **suggestion**

### 4. Tests That Test the Mock, Not the Code
- A test where the mock returns value X and the test asserts value X —
  it proves nothing.
- Severity: **suggestion**

### 5. Missing Edge Cases
- New function handles the happy path but has no test for:
  - Empty input
  - Null / undefined / None
  - Error cases
  - Boundary values
- Severity: **suggestion**

### 6. Skipped or Disabled Tests
- New `it.skip`, `describe.skip`, `xit`, `@pytest.mark.skip` added
  without a TODO comment explaining why.
- Severity: **warning**

## What NOT to flag

- Config files, type definitions, migrations, docs — these don't need tests.
- Trivial getters/setters, pure re-exports.
- If the entire PR is refactoring with no behavior change, missing test updates
  are fine — say so.

## Output format

Same JSON shape as other skills:
```
{
  "file": "src/utils/parser.ts",
  "line": 15,
  "severity": "warning",
  "category": "test-coverage",
  "title": "New function `parseDate` has no tests",
  "explanation": "This function has branching logic that isn't exercised by any test.",
  "impact": "Regressions can slip through unnoticed when this function is changed later.",
  "suggested_fix": "Add a test file `src/utils/parser.test.ts` covering valid dates, invalid strings, and null input."
}
```
