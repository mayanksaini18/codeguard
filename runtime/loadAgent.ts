// Loads the GitAgent definition from disk. Reads agent.yaml, SOUL.md, RULES.md,
// and each skill referenced by the manifest, and returns a single bundled
// AgentDefinition object the rest of the runtime can use.

import { readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { AgentDefinition } from "./types.js";

export async function loadAgent(agentRoot?: string): Promise<AgentDefinition> {
  // If no root is provided, default to the repo containing this runtime file
  // (two levels up from runtime/loadAgent.ts).
  const root =
    agentRoot ??
    resolve(dirname(fileURLToPath(import.meta.url)), "..");

  const manifestPath = join(root, "agent.yaml");
  const manifestRaw = await readFile(manifestPath, "utf-8");
  const manifest = parseYaml(manifestRaw) as {
    name: string;
    version: string;
    description: string;
    model: {
      provider: string;
      name: string;
      temperature: number;
      max_tokens: number;
    };
    identity: { soul: string; rules: string };
    capabilities: { skills: string[] };
  };

  const soul = await readFile(join(root, manifest.identity.soul), "utf-8");
  const rules = await readFile(join(root, manifest.identity.rules), "utf-8");

  const skills = await Promise.all(
    manifest.capabilities.skills.map(async (skillPath) => {
      const body = await readFile(join(root, skillPath), "utf-8");
      const nameMatch = body.match(/^name:\s*(.+)$/m);
      return {
        name: nameMatch?.[1]?.trim() ?? skillPath,
        body,
      };
    })
  );

  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    soul,
    rules,
    skills,
    model: manifest.model,
  };
}
