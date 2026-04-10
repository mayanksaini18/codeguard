---
name: security-audit
description: Detect security vulnerabilities in changed code — secrets, injection, auth bugs, unsafe patterns.
severity_default: critical
languages: [typescript, javascript, python]
---

# Skill: Security Audit

You are reviewing a diff specifically for **security vulnerabilities**.
This is the highest-priority skill. A single missed security bug can cost
a company its reputation.

## What to look for

### 1. Hardcoded Secrets
- API keys, tokens, passwords, private keys committed to code
- Patterns: `sk-...`, `AKIA...`, `ghp_...`, `-----BEGIN PRIVATE KEY-----`,
  long base64/hex strings in string literals
- Severity: **critical**
- **Never include the secret itself in the comment.** Reference the line only.

### 2. Injection Vulnerabilities
- SQL queries built with string concatenation or template literals that embed user input
- Shell commands built from user input without escaping
- `eval()`, `Function()`, `exec()`, `child_process.exec` with untrusted input
- NoSQL query injection (MongoDB `$where`, unsanitized object spreads)
- Severity: **critical**

### 3. Cross-Site Scripting (XSS)
- Raw HTML insertion from untrusted sources: `innerHTML = userInput`,
  `dangerouslySetInnerHTML`, unescaped template output
- Severity: **critical** if untrusted input, **warning** if source is unclear

### 4. Authentication & Authorization
- Routes/endpoints that don't check auth when they should
- Authorization checks that compare to the wrong user (`req.user.id !== someOther.id`)
- JWT verification that skips signature check (`jwt.decode` instead of `jwt.verify`)
- Hardcoded admin bypasses
- Severity: **critical**

### 5. Unsafe Deserialization
- `pickle.loads`, `yaml.load` (without `SafeLoader`), `JSON.parse` with `reviver`
  that executes code
- Severity: **critical**

### 6. Path Traversal
- File paths built from user input without validation (`../../etc/passwd`)
- `fs.readFile(userPath)`, `open(user_path)`
- Severity: **critical**

### 7. Crypto Misuse
- MD5/SHA1 for password hashing
- Hardcoded IVs, ECB mode
- `Math.random()` used for security tokens
- Severity: **warning** to **critical** depending on context

### 8. CORS / CSRF
- `Access-Control-Allow-Origin: *` on authenticated endpoints
- Missing CSRF tokens on state-changing routes
- Severity: **warning**

## Output format

For each finding, produce:
```
{
  "file": "src/db.ts",
  "line": 42,
  "severity": "critical",
  "category": "security",
  "title": "Hardcoded API key detected",
  "explanation": "A secret value appears to be committed directly in source code.",
  "impact": "Anyone with repo access can exfiltrate this credential. Rotate immediately.",
  "suggested_fix": "Move the value to an environment variable and load via process.env.XXX"
}
```

## Remember

- NEVER quote the secret itself in your output.
- If you're not confident something is a vulnerability, use `suggestion`, not `critical`.
- Prefer false negatives over false positives for anything below `critical`.
