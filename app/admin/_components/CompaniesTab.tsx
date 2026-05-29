"use client";

import { useState, useEffect, useCallback } from "react";
import { calculateAtsScore } from "@/lib/atsScoring";
import type { Resume } from "@/types/resume";

type CompanyCategory = "travel" | "ai-agentic" | "general";
type TimeFilter = "2h" | "12h" | "1d" | "2d" | "all";

interface Company {
  name: string;
  url: string;
  color: string; // tailwind bg color class
}

interface Job {
  company: string;
  title: string;
  location: string;
  url: string;
  category: string;
  fetchedAt: string;
  description: string;
}

const TRAVEL_COMPANIES: Company[] = [
  { name: "Live Nation", url: "https://livenation.wd503.myworkdayjobs.com/en-US/LNExternalSite?timeType=def6fe28d9a210a683974354a3d819b6&jobFamilyGroup=def6fe28d9a210a6e1ddb30d81afbf0e&Location_Country=bc33aa3152ec42d4995f4791a106ed09", color: "from-red-500/20 to-red-600/10 border-red-500/30 hover:border-red-400/60" },
  { name: "Airbnb", url: "https://careers.airbnb.com/positions/?_departments=engineering&_where_you_work=united-states&_jobs_sort=updated_at", color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 hover:border-rose-400/60" },
  { name: "Booking.com", url: "https://jobs.booking.com/booking/jobs?page=1&categories=Engineering", color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60" },
  { name: "Sabre", url: "https://sabre.wd1.myworkdayjobs.com/SabreJobs?locationCountry=bc33aa3152ec42d4995f4791a106ed09&jobFamilyGroup=3f7b85291400100e387d58da2a420000", color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-400/60" },
  { name: "NCL", url: "https://nclh.wd108.myworkdayjobs.com/en-US/NCL_Shoreside_Careers/", color: "from-teal-500/20 to-teal-600/10 border-teal-500/30 hover:border-teal-400/60" },
  { name: "Royal Caribbean Group", url: "https://jobs.royalcaribbeangroup.com/search/?q=&q2=&alertId=&locationsearch=&title=Software&location=US&date=#searchresults", color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 hover:border-indigo-400/60" },
  { name: "Disney", url: "https://jobs.disneycareers.com/category/engineering-jobs/17189/21579/1", color: "from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-400/60" },
  { name: "Universal Studios", url: "https://www.nbcunicareers.com/find-a-job?aoi=7641#jobs_search-react-main-wrapper", color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 hover:border-yellow-400/60" },
  { name: "SeaWorld", url: "https://seaworldentertainment.wd1.myworkdayjobs.com/SEA?locations=2324266930e31001c895549bb6530000&locations=2324266930e31001c8954628329e0000&locations=2324266930e31001c8955b403f2c0000&locations=2324266930e31001c895570383370000&locations=2324266930e31001c895506595b80000&locations=893afec753c61000b7fd7b3c19b50000&timeType=21cf1a5c7b78100a88fbafffdaca0003&jobFamilyGroup=862f1dc2c8d31001c8cdb9c6ab430000&workerSubType=862f1dc2c8d31001c80a51915b0e0001", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/60" },
  { name: "SeatGeek (Remote)", url: "https://seatgeek.com/jobs?departments=softwareengineering&locations=remote-unitedstates", color: "from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:border-orange-400/60" },
  { name: "SeatGeek (NY)", url: "https://seatgeek.com/jobs?departments=softwareengineering&locations=remote-unitedstates%2Cnewyorknewyork", color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/60" },
  { name: "StubHub", url: "https://job-boards.greenhouse.io/stubhubinc?departments%5B%5D=4034328101", color: "from-lime-500/20 to-lime-600/10 border-lime-500/30 hover:border-lime-400/60" },
  { name: "AXS", url: "https://job-boards.greenhouse.io/axs?offices%5B%5D=4040814002&departments%5B%5D=4004703002", color: "from-sky-500/20 to-sky-600/10 border-sky-500/30 hover:border-sky-400/60" },
  { name: "CLEAR", url: "https://www.clearme.com/careers", color: "from-blue-400/20 to-blue-500/10 border-blue-400/30 hover:border-blue-300/60" },
  { name: "Flywire", url: "https://www.flywire.com/company/careers/dept/5dacb2c3-6677-425c-b164-530d092d8ce9", color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400/60" },
  { name: "Lyft", url: "https://www.lyft.com/careers#openings?category=software%2520engineering", color: "from-pink-500/20 to-pink-600/10 border-pink-500/30 hover:border-pink-400/60" },
  { name: "Uber Freight", url: "https://www.uber.com/us/en/careers/list/?department=Engineering", color: "from-slate-400/20 to-slate-500/10 border-slate-400/30 hover:border-slate-300/60" },
];

const TABS: { id: CompanyCategory; label: string }[] = [
  { id: "travel", label: "✈️ Travel Ticketing" },
  { id: "ai-agentic", label: "🤖 AI & Agentic" },
  { id: "general", label: "🌐 General Full Stack" },
];

const TIME_FILTERS: { id: TimeFilter; label: string; ms: number }[] = [
  { id: "2h",  label: "⚡ Last 2 hrs",  ms: 2  * 3_600_000 },
  { id: "12h", label: "Last 12 hrs", ms: 12 * 3_600_000 },
  { id: "1d",  label: "Last 24 hrs", ms: 24 * 3_600_000 },
  { id: "2d",  label: "Last 48 hrs", ms: 48 * 3_600_000 },
  { id: "all", label: "All time",    ms: Infinity },
];

function filterByTime(jobs: Job[], filter: TimeFilter): Job[] {
  if (filter === "all") return jobs;
  const { ms } = TIME_FILTERS.find((f) => f.id === filter)!;
  const now = Date.now();
  return jobs.filter(
    (j) => j.fetchedAt && now - new Date(j.fetchedAt).getTime() <= ms
  );
}

function timeAgo(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const m = Math.floor(elapsed / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CompanyCard({
  company,
  jobCount,
  newCount,
  isSelected,
  onSelect,
}: {
  company: Company;
  jobCount: number;
  newCount: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={[
        "group flex flex-col gap-2 rounded-xl border bg-gradient-to-br p-4 transition-all duration-200 cursor-pointer",
        company.color,
        isSelected ? "ring-2 ring-indigo-400/60" : "",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-200 text-sm leading-tight group-hover:text-white transition-colors">
          {company.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {newCount > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          <a
            href={company.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
            aria-label={`Open ${company.name} careers`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" x2="21" y1="14" y2="3" />
            </svg>
          </a>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors truncate">
          {new URL(company.url).hostname}
        </span>
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {newCount > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              +{newCount} new
            </span>
          )}
          {jobCount > 0 && (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
              {jobCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyCategory({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-10 opacity-30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
      <p className="text-sm">No companies added yet for <span className="text-slate-400">{label}</span></p>
    </div>
  );
}

// ── ATS badge ────────────────────────────────────────────────────────────────
function AtsBadge({ score, label }: { score: number; label: "high" | "medium" | "low" }) {
  const colours =
    label === "high"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : label === "medium"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-slate-500/15 text-slate-500 border-slate-500/30";
  return (
    <span
      title="ATS match score"
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${colours}`}
    >
      {score}%
    </span>
  );
}

export default function CompaniesTab() {
  const [activeCategory, setActiveCategory] = useState<CompanyCategory>("travel");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("2h");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [generating, setGenerating] = useState<Record<string, "resume" | "cover">>({});

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");
      setJobs(data.jobs ?? []);
      setLastFetched(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetch("/api/resume")
      .then((r) => r.json())
      .then((d) => { if (d) setResume(d as Resume); })
      .catch(() => {/* silent */});
  }, []);

  const handleGenerate = useCallback(
    async (job: Job, type: "resume" | "cover") => {
      const key = `${job.url}:${type}`;
      setGenerating((prev) => ({ ...prev, [key]: type }));
      try {
        const res = await fetch("/api/resume/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: job.title,
            company: job.company,
            description: job.description,
            type,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error ?? "Generation failed");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          type === "cover"
            ? `${job.company.replace(/\s+/g, "_")}_Cover_Letter.pdf`
            : `${job.company.replace(/\s+/g, "_")}_Resume.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } finally {
        setGenerating((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    []
  );

  // Filtered jobs based on selected time window
  const filteredJobs = filterByTime(jobs, timeFilter);
  // Always track "last 2h" jobs for the pulsing dot on cards
  const newJobs = filterByTime(jobs, "2h");

  // Group by company for both filtered and "new" sets
  const jobsByCompany = filteredJobs.reduce<Record<string, Job[]>>((acc, job) => {
    (acc[job.company] ??= []).push(job);
    return acc;
  }, {});
  const newByCompany = newJobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.company] = (acc[job.company] ?? 0) + 1;
    return acc;
  }, {});

  const selectedJobs = selectedCompany ? (jobsByCompany[selectedCompany] ?? []) : [];
  const totalFiltered = filteredJobs.length;
  const totalJobs = jobs.length;

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Companies</h2>
          <p className="mt-1 text-sm text-slate-500">
            Job portals organised by domain — click a card to see open engineering roles.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            type="button"
            onClick={fetchJobs}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={["h-3 w-3", loading ? "animate-spin" : ""].join(" ")}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {lastFetched && !loading && (
            <span className="text-[10px] text-slate-600">
              {totalJobs} total · updated {lastFetched}
            </span>
          )}
          {error && (
            <span className="text-[10px] text-amber-500">
              ⚠ {error === "Google Sheets not configured"
                ? "Sheets not configured yet"
                : error}
            </span>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-white/5 p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setActiveCategory(id); setSelectedCompany(null); setExpandedJob(null); }}
            className={[
              "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
              activeCategory === id
                ? "bg-indigo-500/20 text-indigo-300 shadow"
                : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Time filter pills */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-600 mr-1">Show new jobs from:</span>
        {TIME_FILTERS.map(({ id, label }) => {
          const count = id === "all" ? jobs.length : filterByTime(jobs, id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTimeFilter(id)}
              className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium border transition-all duration-150",
                timeFilter === id
                  ? "bg-indigo-500/25 text-indigo-300 border-indigo-500/50 shadow"
                  : "bg-white/5 text-slate-500 border-white/10 hover:text-slate-300 hover:border-white/20",
              ].join(" ")}
            >
              {label}
              {count > 0 && (
                <span className={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  timeFilter === id
                    ? "bg-indigo-500/30 text-indigo-200"
                    : id === "2h" && count > 0
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-white/10 text-slate-400",
                ].join(" ")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {totalFiltered > 0 && (
          <span className="ml-auto text-[11px] text-slate-600">
            {totalFiltered} role{totalFiltered !== 1 ? "s" : ""} shown
          </span>
        )}
      </div>

      {/* Content */}
      {activeCategory === "travel" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {TRAVEL_COMPANIES.map((company) => (
              <CompanyCard
                key={company.name}
                company={company}
                jobCount={jobsByCompany[company.name]?.length ?? 0}
                newCount={newByCompany[company.name] ?? 0}
                isSelected={selectedCompany === company.name}
                onSelect={() => {
                    setSelectedCompany(
                      selectedCompany === company.name ? null : company.name
                    );
                    setExpandedJob(null);
                  }}
              />
            ))}
          </div>

          {/* Jobs panel */}
          {selectedCompany && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    {selectedCompany}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedJobs.length === 0
                      ? timeFilter === "all"
                        ? "No engineering roles scraped yet"
                        : `No new roles in the ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`
                      : `${selectedJobs.length} engineering ${selectedJobs.length === 1 ? "role" : "roles"} · ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCompany(null)}
                  className="text-slate-600 hover:text-slate-300 transition-colors p-1"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Job list */}
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-600 text-sm">
                  Loading jobs…
                </div>
              ) : selectedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <p className="text-sm">
                    {error
                      ? "Configure Google Sheets to see live jobs"
                      : timeFilter === "all"
                      ? "No roles scraped yet — automation runs every 30 min 4 AM–6 PM PDT"
                      : `No new roles in the ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()} — try a wider window`}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                  {selectedJobs.map((job, i) => {
                    const isNew = job.fetchedAt &&
                      Date.now() - new Date(job.fetchedAt).getTime() <= 2 * 3_600_000;
                    const isExpanded = expandedJob === job.url;
                    const ats = resume && job.description
                      ? calculateAtsScore(job.description, resume)
                      : null;
                    const resumeKey = `${job.url}:resume`;
                    const coverKey = `${job.url}:cover`;
                    const genResume = !!generating[resumeKey];
                    const genCover  = !!generating[coverKey];
                    return (
                      <li key={i} className={["px-5 py-3 hover:bg-white/[0.03] transition-colors", isExpanded ? "bg-white/[0.02]" : ""].join(" ")}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-slate-200 truncate font-medium">{job.title}</p>
                              {isNew && (
                                <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                                  NEW
                                </span>
                              )}
                              {ats && <AtsBadge score={ats.score} label={ats.label} />}
                            </div>
                            {job.location && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{job.location}</p>
                            )}
                          </div>
                          {job.fetchedAt && (
                            <span className="text-[10px] text-slate-600 shrink-0 hidden sm:block">
                              {timeAgo(job.fetchedAt)}
                            </span>
                          )}
                          {/* Generate resume PDF */}
                          {job.description && (
                            <button
                              type="button"
                              title="Generate tailored resume PDF"
                              disabled={genResume || genCover}
                              onClick={() => handleGenerate(job, "resume")}
                              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all disabled:opacity-40"
                            >
                              {genResume ? "…" : "📄 CV"}
                            </button>
                          )}
                          {/* Generate cover letter PDF */}
                          {job.description && (
                            <button
                              type="button"
                              title="Generate cover letter PDF"
                              disabled={genResume || genCover}
                              onClick={() => handleGenerate(job, "cover")}
                              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all disabled:opacity-40"
                            >
                              {genCover ? "…" : "✉ CL"}
                            </button>
                          )}
                          {job.description && (
                            <button
                              type="button"
                              onClick={() => setExpandedJob(isExpanded ? null : job.url)}
                              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"
                              aria-label={isExpanded ? "Hide description" : "Show description"}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          )}
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 hover:text-slate-100 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all"
                          >
                            Apply
                          </a>
                        </div>
                        {isExpanded && job.description && (
                          <div className="mt-3 pt-3 border-t border-white/5">
                            {ats && (
                              <div className="mb-2 flex flex-wrap gap-1 items-center">
                                <span className="text-[10px] text-slate-600">Matched:</span>
                                {ats.matched.slice(0, 10).map((kw) => (
                                  <span key={kw} className="rounded px-1.5 py-0.5 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{kw}</span>
                                ))}
                                {ats.missing.length > 0 && (
                                  <>
                                    <span className="text-[10px] text-slate-600 ml-1">Missing:</span>
                                    {ats.missing.slice(0, 5).map((kw) => (
                                      <span key={kw} className="rounded px-1.5 py-0.5 text-[9px] bg-slate-500/10 text-slate-500 border border-slate-500/20">{kw}</span>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                            <div className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto pr-1">
                              {job.description}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {activeCategory === "ai-agentic" && (
        <EmptyCategory label="AI & Agentic" />
      )}

      {activeCategory === "general" && (
        <EmptyCategory label="General Full Stack" />
      )}
    </section>
  );
}
