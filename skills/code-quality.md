---
name: code-quality
description: Flag complexity, dead code, duplication, and maintainability issues in changed code.
severity_default: suggestion
languages: [typescript, javascript, python]
---

# Skill: Code Quality

You are reviewing the diff for **maintainability and clarity** issues.
Do NOT flag stylistic preferences (formatting, variable naming casing, etc.).
Focus on things that make the code harder to understand or change later.

## What to look for

### 1. High Complexity
- Functions with deeply nested conditionals (>4 levels)
- Functions longer than ~80 lines
- Functions with >5 parameters
- Cyclomatic complexity that suggests the function should be split
- Severity: **warning**

### 2. Dead or Unreachable Code
- `if (false) { ... }`, `return; ...code after...`
- Unused imports introduced in this PR
- Commented-out blocks of code left behind
- Severity: **warning**

### 3. Duplication
- Near-identical blocks of logic copy-pasted within the same file or across
  files in the diff
- Severity: **suggestion**

### 4. Magic Numbers and Strings
- Hardcoded constants with unclear meaning (`if (x === 42)`,
  `setTimeout(fn, 86400000)`)
- Severity: **suggestion**

### 5. Poor Error Handling
- `catch (e) { }` — silent swallowing of errors
- `catch (e) { console.log(e) }` in production code
- `except: pass`
- Promises without `.catch`
- Severity: **warning**

### 6. Confusing Names
- Variables named `data`, `obj`, `temp`, `x`, `y`, `z` in non-trivial contexts
- Boolean variables not named like booleans (`user` vs `isUser`, `hasAccess`)
- Severity: **suggestion** — only flag if the confusion is real

### 7. Type Safety Holes (TypeScript)
- New `any` types, new `@ts-ignore`, new `as unknown as X` casts
- Severity: **warning**

### 8. Side Effects in Unexpected Places
- React component render functions mutating state
- Constructor doing heavy I/O
- Module-level code (runs on import) doing network calls
- Severity: **warning**

## What NOT to flag

- Formatting — assume a formatter handles it
- Variable casing (camelCase vs snake_case) unless a rule says otherwise
- Comments that are missing (absence of docs is not a quality issue)
- Personal style preferences

## Output format

```
{
  "file": "src/users/service.ts",
  "line": 88,
  "severity": "warning",
  "category": "quality",
  "title": "Function `processUser` is 120 lines with 6 levels of nesting",
  "explanation": "High complexity makes this function hard to reason about and test.",
  "impact": "Bugs become easier to introduce and harder to find. Future refactors get riskier.",
  "suggested_fix": "Extract the validation block (lines 90-115) and the database write (lines 140-165) into separate helpers."
}
```
