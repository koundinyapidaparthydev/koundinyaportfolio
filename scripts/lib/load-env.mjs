/**
 * Load .env.local when running scripts locally (not in GitHub Actions).
 */
import { existsSync, readFileSync } from "fs";

export function loadEnvLocal(cwd = process.cwd()) {
  const path = `${cwd}/.env.local`;
  if (!existsSync(path)) return;

  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    if (!key) continue;
    const cur = process.env[key];
    if (!cur) {
      process.env[key] = val;
    } else if (val.startsWith("{")) {
      try {
        JSON.parse(cur);
      } catch {
        process.env[key] = val;
      }
    }
  }
}
