# CodeGuard

> A git-native, framework-agnostic AI PR reviewer built on the [GitAgent](https://github.com/open-gitagent/gitagent) standard.

**CodeGuard is a git repository that reviews other git repositories.**
Clone it, fork it, edit its `SOUL.md`, diff its `skills/` — it is a fully
version-controlled AI reviewer that you can treat like any other piece of
source code.

---

## Why CodeGuard?

Most AI code reviewers are black boxes:

- You can't see *why* they flagged something
- You can't edit their rules without paying for a plan
- You can't version-control their behavior
- You can't fork them per team

CodeGuard flips that. **The reviewer's brain is the repo.** Every rule,
every skill, every personality trait is a human-readable file you can
read, diff, fork, and change.

```
SOUL.md     ← how the reviewer talks
RULES.md    ← what it will never do
skills/     ← what it checks for
tools/      ← how it touches GitHub
runtime/    ← the tiny orchestrator that glues it together
```

Want a stricter reviewer on your banking codebase? Fork, tighten `RULES.md`,
commit. Done.

---

## What it does

On every pull request, CodeGuard:

1. Reads the changed files (TypeScript, JavaScript, Python)
2. Runs four skills against the diff:
   - **security-audit** — secrets, injection, XSS, auth bugs
   - **test-coverage** — new code without tests, weak assertions
   - **code-quality** — complexity, dead code, poor error handling
   - **breaking-changes** — removed exports, API signature changes
3. Posts inline comments on specific lines
4. Posts a summary comment with pass/warn/fail verdict
5. Opens GitHub issues for every `critical` finding
6. Fails the CI job if any critical issues are found (never auto-merges)

---

## Install in your repo (2 minutes)

### Step 1 — Add your Anthropic API key

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `ANTHROPIC_API_KEY`
- Value: your key from [console.anthropic.com](https://console.anthropic.com)

### Step 2 — Drop in the workflow

Copy [`examples/consumer-workflow.yml`](./examples/consumer-workflow.yml)
into your repo at `.github/workflows/codeguard.yml`.

That's it. Open a PR and CodeGuard will review it.

---

## Run it locally

```bash
git clone https://github.com/mayanksaini18/codeguard
cd codeguard
npm install
cp .env.example .env   # fill in your keys

npx tsx runtime/index.ts --owner your-org --repo your-repo --pr 42
```

---

## Project structure

```
codeguard/
├── agent.yaml              ← GitAgent manifest
├── SOUL.md                 ← reviewer personality
├── RULES.md                ← hard constraints
├── skills/
│   ├── security-audit.md
│   ├── test-coverage.md
│   ├── code-quality.md
│   └── breaking-changes.md
├── tools/
│   └── github-pr.md        ← GitHub API tool definition
├── runtime/
│   ├── index.ts            ← orchestrator entrypoint
│   ├── loadAgent.ts        ← reads agent.yaml + skill files
│   ├── github.ts           ← Octokit wrapper
│   ├── claude.ts           ← Anthropic SDK wrapper
│   └── types.ts
├── .github/workflows/review.yml   ← workflow used by this repo itself
├── examples/consumer-workflow.yml ← copy-paste into your repo
└── README.md
```

---

## Customizing CodeGuard for your team

Because CodeGuard is just a git repo, customizing it is a `git commit`:

- **Softer reviewer?** Edit `SOUL.md` — change personality to "gentle mentor"
- **Stricter rules?** Edit `RULES.md` — lower the approval bar
- **New skill?** Drop a new file in `skills/`, reference it from `agent.yaml`
- **Different languages?** Edit `RULES.md` rule 8 to add Go, Ruby, Rust, etc.
- **Different model?** Change `model.name` in `agent.yaml`

Every change is a diff. Every rollback is a `git revert`. That's the
promise of GitAgent.

---

## How it fits the GitAgent standard

CodeGuard is a reference implementation of the
[GitAgent v0.1.0 spec](https://github.com/open-gitagent/gitagent/blob/main/spec/SPECIFICATION.md):

| GitAgent requirement | CodeGuard file |
|---------------------|----------------|
| `agent.yaml` manifest | ✅ [`agent.yaml`](./agent.yaml) |
| `SOUL.md` identity | ✅ [`SOUL.md`](./SOUL.md) |
| `RULES.md` hard constraints | ✅ [`RULES.md`](./RULES.md) |
| `skills/` modular capabilities | ✅ [`skills/`](./skills) |
| `tools/` MCP-style tool defs | ✅ [`tools/`](./tools) |
| Compliance block (risk tier, HITL, audit) | ✅ in `agent.yaml` |
| Human-in-the-loop guarantee | ✅ never auto-merges |
| Audit logging | ✅ structured JSON audit lines |

---

## Requirements

- Node.js ≥ 20
- An Anthropic API key
- A GitHub repo where you want reviews

---

## License

MIT — fork it, break it, improve it.

---

## Built for the GitAgent Hackathon

CodeGuard was built for the
[GitAgent Hackathon](https://hackculture.io/hackathons/gitagent-hackathon)
by Lyzr AI — to show that the repo-as-agent pattern unlocks real products,
not just demos.
