export type MissingSkillUserStatus = "open" | "added" | "dismissed";

export interface MissingSkillStatusRecord {
  status: MissingSkillUserStatus;
  updatedAt: string;
  note?: string;
}

export type MissingSkillStatusMap = Record<string, MissingSkillStatusRecord>;

const STORAGE_KEY = "admin-missing-skills-status";

export function loadMissingSkillStatuses(): MissingSkillStatusMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MissingSkillStatusMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMissingSkillStatuses(map: MissingSkillStatusMap): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function setMissingSkillStatus(
  map: MissingSkillStatusMap,
  normalizedKey: string,
  status: MissingSkillUserStatus
): MissingSkillStatusMap {
  const next = { ...map };
  if (status === "open") {
    delete next[normalizedKey];
    return next;
  }
  next[normalizedKey] = {
    status,
    updatedAt: new Date().toISOString(),
  };
  return next;
}
