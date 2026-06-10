import { readFileSync } from "fs";
import { join } from "path";

export function loadResume(cwd = process.cwd()) {
  const path = join(cwd, "data", "resume.json");
  return JSON.parse(readFileSync(path, "utf8"));
}
