import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function applyEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadEnvFiles() {
  // Only the local job reads .env files. In CI the workflow supplies env; the Worker never calls this.
  if (!import.meta.url) return;
  const here = path.dirname(fileURLToPath(import.meta.url));
  applyEnvFile(path.resolve(here, "../../.env"));
  applyEnvFile(path.resolve(here, "../../.env.local"));
  applyEnvFile(path.resolve(here, "../.env"));
}
