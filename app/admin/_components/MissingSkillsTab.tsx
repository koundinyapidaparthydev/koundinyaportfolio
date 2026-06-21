"use client";

/**
 * MissingSkillsTab — aggregates ATS keyGaps + recommendedKeywords across scraped jobs.
 * Cross-checks against the current resume and lets you track what to add.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@/app/api/jobs/route";
import {
  aggregateMissingSkills,
  filterMissingSkills,
  summarizeMissingSkills,
  type MissingSkillFilter,
  type AggregatedMissingSkill,
} from "@/lib/admin/missingSkillsAggregate";
import {
  loadMissingSkillStatuses,
  saveMissingSkillStatuses,
  setMissingSkillStatus,
  type MissingSkillUserStatus,
} from "@/lib/admin/missingSkillsStorage";
import { extractResumeSkills } from "@/lib/admin/resumeSkills";
import { useResume } from "@/hooks/useResume";
import { glass, glassCn } from "@/lib/glass";
import { AdminPageHeader, AdminStatCard } from "./AdminShell";

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load jobs");
  const data = (await res.json()) as { jobs: Job[]; error?: string };
  if (data.error && data.jobs.length === 0) {
    throw new Error(data.error);
  }
  return data.jobs;
}

const FILTER_OPTIONS: { id: MissingSkillFilter; label: string }[] = [
  { id: "actionable", label: "Add to resume" },
  { id: "all", label: "All gaps" },
  { id: "on-resume", label: "Already on resume" },
  { id: "added", label: "Marked added" },
  { id: "dismissed", label: "Dismissed" },
];

function StatusBadge({ skill }: { skill: AggregatedMissingSkill }) {
  if (skill.onResume) {
    return (
      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
        On resume
      </span>
    );
  }
  if (skill.userStatus === "added") {
    return (
      <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
        Marked added
      </span>
    );
  }
  if (skill.userStatus === "dismissed") {
    return (
      <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Dismissed
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
      Missing
    </span>
  );
}

function SkillActions({
  skill,
  onStatusChange,
}: {
  skill: AggregatedMissingSkill;
  onStatusChange: (key: string, status: MissingSkillUserStatus) => void;
}) {
  const btn =
    "rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40";

  return (
    <div className="flex flex-wrap gap-1.5">
      {skill.userStatus !== "added" && (
        <button
          type="button"
          className={glassCn(glass.btn, btn)}
          onClick={() => onStatusChange(skill.normalizedKey, "added")}
        >
          Mark added
        </button>
      )}
      {skill.userStatus !== "dismissed" && skill.userStatus !== "added" && (
        <button
          type="button"
          className={glassCn(glass.btnGhost, btn)}
          onClick={() => onStatusChange(skill.normalizedKey, "dismissed")}
        >
          Dismiss
        </button>
      )}
      {skill.userStatus !== "open" && (
        <button
          type="button"
          className={glassCn(glass.btnGhost, btn)}
          onClick={() => onStatusChange(skill.normalizedKey, "open")}
        >
          Reopen
        </button>
      )}
    </div>
  );
}

export default function MissingSkillsTab() {
  const [filter, setFilter] = useState<MissingSkillFilter>("actionable");
  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [userStatuses, setUserStatuses] = useState(loadMissingSkillStatuses);

  const { data: jobs = [], isLoading, error } = useQuery({
    queryKey: ["all-jobs"],
    queryFn: fetchJobs,
  });

  const { data: resume } = useResume();
  const resumeSkills = useMemo(() => extractResumeSkills(resume), [resume]);

  const aggregated = useMemo(
    () =>
      aggregateMissingSkills(jobs, {
        resumeSkills,
        userStatuses,
      }),
    [jobs, resumeSkills, userStatuses]
  );

  const summary = useMemo(() => summarizeMissingSkills(aggregated), [aggregated]);

  const filtered = useMemo(() => {
    let list = filterMissingSkills(aggregated, filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.term.toLowerCase().includes(q) ||
          s.jobs.some(
            (j) =>
              j.company.toLowerCase().includes(q) || j.title.toLowerCase().includes(q)
          )
      );
    }
    return list;
  }, [aggregated, filter, search]);

  const handleStatusChange = useCallback(
    (normalizedKey: string, status: MissingSkillUserStatus) => {
      setUserStatuses((prev) => {
        const next = setMissingSkillStatus(prev, normalizedKey, status);
        saveMissingSkillStatuses(next);
        return next;
      });
    },
    []
  );

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={glassCn(glass.adminPanel, "p-6 text-sm text-red-500")}>
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Missing Skills"
        subtitle="Skills Gemini flagged across scraped jobs (columns P & Q). Add high-frequency gaps to your base resume in Edit Resume — better overlap raises ATS scores on future runs."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Unique gaps"
          value={summary.uniqueTerms}
          sub={`From ${summary.jobsWithGaps} jobs with ATS data`}
        />
        <AdminStatCard
          label="Add to resume"
          value={summary.actionableCount}
          sub="Not on resume yet"
          accent
        />
        <AdminStatCard
          label="Already covered"
          value={summary.onResumeCount}
          sub="Term matches resume skills"
        />
        <AdminStatCard
          label="Jobs analyzed"
          value={jobs.length}
          sub="Current Hiring Cafe sheet"
        />
      </div>

      {summary.topActionable.length > 0 && filter === "actionable" && (
        <div className={glassCn(glass.adminPanel, "p-4")}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Top priorities
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.topActionable.map((skill) => (
              <span
                key={skill.normalizedKey}
                className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200"
              >
                {skill.term}
                <span className="ml-1.5 text-amber-600/80 dark:text-amber-300/80">
                  ×{skill.jobCount}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={glassCn(glass.adminPanel, "flex flex-wrap items-center gap-3 p-4")}>
        <div className={glassCn(glass.tabGroup, "flex flex-wrap gap-1 p-1")}>
          {FILTER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === id
                  ? glassCn(glass.adminPillActive, "text-indigo-600 dark:text-indigo-300")
                  : "text-slate-500 hover:bg-muted/50",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skill or company…"
          className={glassCn(glass.inputCompact, "ml-auto min-w-[200px] flex-1 sm:max-w-xs")}
        />
      </div>

      <div className={glassCn(glass.adminPanel, "overflow-hidden")}>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {aggregated.length === 0
              ? "No gap data yet — run the ATS pipeline on scraped jobs (columns P & Q)."
              : "No skills match this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={glassCn(glass.adminTable, "w-full min-w-[720px] text-sm")}>
              <thead className={glass.adminTableHead}>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Skill / gap</th>
                  <th className="px-4 py-3 text-left font-semibold">Jobs</th>
                  <th className="px-4 py-3 text-left font-semibold">Sources</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((skill) => {
                  const expanded = expandedKey === skill.normalizedKey;
                  return (
                    <SkillRow
                      key={skill.normalizedKey}
                      skill={skill}
                      expanded={expanded}
                      onToggle={() => toggleExpanded(skill.normalizedKey)}
                      onStatusChange={handleStatusChange}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillRow({
  skill,
  expanded,
  onToggle,
  onStatusChange,
}: {
  skill: AggregatedMissingSkill;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (key: string, status: MissingSkillUserStatus) => void;
}) {
  return (
    <>
      <tr className="border-t border-border/30 hover:bg-muted/20">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-left font-medium text-slate-900 dark:text-white"
          >
            <span className="text-slate-400">{expanded ? "▾" : "▸"}</span>
            {skill.term}
          </button>
        </td>
        <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
          {skill.jobCount}
        </td>
        <td className="px-4 py-3 text-xs text-slate-500">
          {skill.keyGapsCount > 0 && (
            <span>Gaps {skill.keyGapsCount}</span>
          )}
          {skill.keyGapsCount > 0 && skill.keywordsCount > 0 && " · "}
          {skill.keywordsCount > 0 && (
            <span>Keywords {skill.keywordsCount}</span>
          )}
        </td>
        <td className="px-4 py-3">
          <StatusBadge skill={skill} />
        </td>
        <td className="px-4 py-3">
          <SkillActions skill={skill} onStatusChange={onStatusChange} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border/20 bg-muted/10">
          <td colSpan={5} className="px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Seen in jobs
            </p>
            <ul className="space-y-1.5">
              {skill.jobs.map((job) => (
                <li
                  key={`${job.rowIndex}-${job.company}-${job.title}`}
                  className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {job.company}
                  </span>
                  <span className="text-slate-500">— {job.title}</span>
                  {job.atsScore && (
                    <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] tabular-nums">
                      ATS {job.atsScore}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
