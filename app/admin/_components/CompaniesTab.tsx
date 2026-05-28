"use client";

import { useState } from "react";

type CompanyCategory = "travel" | "ai-agentic" | "general";

interface Company {
  name: string;
  url: string;
  color: string; // tailwind bg color class
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
  { name: "Uber", url: "https://www.uber.com/us/en/careers/list/?department=Engineering", color: "from-slate-400/20 to-slate-500/10 border-slate-400/30 hover:border-slate-300/60" },
];

const TABS: { id: CompanyCategory; label: string }[] = [
  { id: "travel", label: "✈️ Travel Ticketing" },
  { id: "ai-agentic", label: "🤖 AI & Agentic" },
  { id: "general", label: "🌐 General Full Stack" },
];

function CompanyCard({ company }: { company: Company }) {
  return (
    <a
      href={company.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col gap-2 rounded-xl border bg-gradient-to-br p-4 transition-all duration-200 ${company.color}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-200 text-sm leading-tight group-hover:text-white transition-colors">
          {company.name}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors mt-0.5"
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
      </div>
      <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors truncate">
        {new URL(company.url).hostname}
      </span>
    </a>
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

export default function CompaniesTab() {
  const [activeCategory, setActiveCategory] = useState<CompanyCategory>("travel");

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-100">Companies</h2>
        <p className="mt-1 text-sm text-slate-500">
          Job portals organised by domain — click any card to open the listings.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-white/5 p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveCategory(id)}
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

      {/* Content */}
      {activeCategory === "travel" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TRAVEL_COMPANIES.map((company) => (
            <CompanyCard key={company.name} company={company} />
          ))}
        </div>
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
