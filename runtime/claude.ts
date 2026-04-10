// Claude SDK wrapper. Builds the system prompt from the GitAgent definition
// and asks Claude to produce a structured JSON review of a PR.

import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentDefinition,
  Finding,
  PRContext,
  ReviewResult,
} from "./types.js";

export class ClaudeReviewer {
  private client: Anthropic;
  private agent: AgentDefinition;

  constructor(apiKey: string, agent: AgentDefinition) {
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is required. Set it in your environment or GitHub secrets."
      );
    }
    this.client = new Anthropic({ apiKey });
    this.agent = agent;
  }

  private buildSystemPrompt(): string {
    const skillsBlock = this.agent.skills
      .map(
        (s) =>
          `### Skill: ${s.name}\n\n${s.body}\n\n---`
      )
      .join("\n\n");

    return [
      `You are ${this.agent.name} v${this.agent.version}.`,
      this.agent.description,
      "",
      "## Your Soul",
      this.agent.soul,
      "",
      "## Hard Rules (must follow)",
      this.agent.rules,
      "",
      "## Skills",
      skillsBlock,
      "",
      "## Output Format",
      "You MUST respond with a single JSON object (no markdown fences, no prose)",
      "matching this exact shape:",
      "",
      "```",
      "{",
      '  "findings": [',
      "    {",
      '      "file": "path/to/file.ts",',
      '      "line": 42,',
      '      "severity": "critical" | "warning" | "suggestion" | "nit",',
      '      "category": "security" | "test-coverage" | "quality" | "breaking-change",',
      '      "title": "short title",',
      '      "explanation": "what the issue is",',
      '      "impact": "why it matters",',
      '      "suggested_fix": "concrete fix"',
      "    }",
      "  ],",
      '  "summary": "one-paragraph overall assessment",',
      '  "verdict": "pass" | "warn" | "fail"',
      "}",
      "```",
      "",
      "Rules for the output:",
      "- `fail` if ANY finding has severity `critical`.",
      "- `warn` if any finding has severity `warning` (and none critical).",
      "- `pass` otherwise.",
      "- Never exceed 15 findings. Keep the most severe ones.",
      "- Use line numbers from the NEW version of the file (RIGHT side of the diff).",
      "- Output ONLY the JSON object. No explanation text around it.",
    ].join("\n");
  }

  private buildUserPrompt(pr: PRContext): string {
    const fileBlocks = pr.files
      .map((f) => {
        const patch = f.patch ?? "(no patch available — file too large or binary)";
        return [
          `### File: ${f.filename} (${f.status}, +${f.additions} -${f.deletions})`,
          "```diff",
          patch,
          "```",
        ].join("\n");
      })
      .join("\n\n");

    return [
      `# Pull Request #${pr.number}`,
      `**Title:** ${pr.title}`,
      `**Author:** ${pr.author}`,
      `**Base:** ${pr.baseSha.slice(0, 7)} → **Head:** ${pr.headSha.slice(0, 7)}`,
      "",
      "## PR Description",
      pr.body || "_(no description provided)_",
      "",
      "## Changed Files",
      fileBlocks || "_(no reviewable files)_",
      "",
      "---",
      "",
      "Now review this PR following your soul, rules, and skills.",
      "Respond with a single JSON object only.",
    ].join("\n");
  }

  async review(pr: PRContext): Promise<ReviewResult> {
    if (pr.files.length === 0) {
      return {
        findings: [],
        summary:
          "No reviewable files in this PR (all changes were in ignored paths or unsupported languages).",
        verdict: "pass",
      };
    }

    const system = this.buildSystemPrompt();
    const user = this.buildUserPrompt(pr);

    const response = await this.client.messages.create({
      model: this.agent.model.name,
      max_tokens: this.agent.model.max_tokens,
      temperature: this.agent.model.temperature,
      system,
      messages: [{ role: "user", content: user }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude returned no text content");
    }

    return parseReviewJson(textBlock.text);
  }
}

function parseReviewJson(raw: string): ReviewResult {
  // Strip accidental markdown fences if the model ignored instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Failed to parse Claude response as JSON: ${(err as Error).message}\n\nRaw:\n${raw.slice(0, 500)}`
    );
  }

  const obj = parsed as ReviewResult;
  if (!Array.isArray(obj.findings)) {
    throw new Error("Claude response missing `findings` array");
  }
  if (typeof obj.summary !== "string") {
    throw new Error("Claude response missing `summary` string");
  }
  if (!["pass", "warn", "fail"].includes(obj.verdict)) {
    throw new Error(`Claude response has invalid verdict: ${obj.verdict}`);
  }

  // Enforce the 15-finding cap, keeping the most severe.
  const severityRank: Record<Finding["severity"], number> = {
    critical: 0,
    warning: 1,
    suggestion: 2,
    nit: 3,
  };
  obj.findings.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity]
  );
  obj.findings = obj.findings.slice(0, 15);

  return obj;
}
