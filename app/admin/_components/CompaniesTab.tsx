"use client";

import { useState, useEffect, useCallback } from "react";
import { calculateAtsScore } from "@/lib/atsScoring";
import type { Resume } from "@/types/resume";
import type { AtsResult } from "@/lib/atsScoring";

type CompanyCategory = "travel" | "ai-agentic" | "general" | "hiring-cafe";
type TimeFilter = "2h" | "12h" | "1d" | "2d";
type SortMode = "newest" | "ats" | "title";
type LocationFilter = "all" | "remote" | "onsite";

interface Company {
  name: string;
  url: string;
  color: string; // tailwind bg color class
  logo: string;  // path under /Company_Images/
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
  { name: "Live Nation",          url: "https://livenation.wd503.myworkdayjobs.com/en-US/LNExternalSite?timeType=def6fe28d9a210a683974354a3d819b6&jobFamilyGroup=def6fe28d9a210a6e1ddb30d81afbf0e&Location_Country=bc33aa3152ec42d4995f4791a106ed09", color: "from-red-500/20 to-red-600/10 border-red-500/30 hover:border-red-400/60",     logo: "/Company_Images/LiveNation.jpg" },
  { name: "Airbnb",               url: "https://careers.airbnb.com/positions/?_departments=engineering&_where_you_work=united-states&_jobs_sort=updated_at",                                                                                                                                                       color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 hover:border-rose-400/60",   logo: "/Company_Images/Airbnb.jpg" },
  { name: "Booking.com",          url: "https://jobs.booking.com/booking/jobs?page=1&categories=Engineering",                                                                                                                                                                                                     color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60",   logo: "/Company_Images/BookingCom.jpg" },
  { name: "Sabre",                url: "https://sabre.wd1.myworkdayjobs.com/SabreJobs?locationCountry=bc33aa3152ec42d4995f4791a106ed09&jobFamilyGroup=3f7b85291400100e387d58da2a420000",                                                                                                                           color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-400/60",   logo: "/Company_Images/Sabre.jpg" },
  { name: "NCL",                  url: "https://nclh.wd108.myworkdayjobs.com/en-US/NCL_Shoreside_Careers/",                                                                                                                                                                                                       color: "from-teal-500/20 to-teal-600/10 border-teal-500/30 hover:border-teal-400/60",   logo: "/Company_Images/NCL.jpg" },
  { name: "Royal Caribbean Group",url: "https://jobs.royalcaribbeangroup.com/search/?q=&q2=&alertId=&locationsearch=&title=Software&location=US&date=#searchresults",                                                                                                                                              color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 hover:border-indigo-400/60", logo: "/Company_Images/RoyalCaribbean.jpg" },
  { name: "Disney",               url: "https://jobs.disneycareers.com/category/engineering-jobs/17189/21579/1",                                                                                                                                                                                                  color: "from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-400/60", logo: "/Company_Images/Disney.jpg" },
  { name: "Universal Studios",    url: "https://www.nbcunicareers.com/find-a-job?aoi=7641#jobs_search-react-main-wrapper",                                                                                                                                                                                        color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 hover:border-yellow-400/60", logo: "/Company_Images/UniversalStudios.jpg" },
  { name: "SeaWorld",             url: "https://seaworldentertainment.wd1.myworkdayjobs.com/SEA?locations=2324266930e31001c895549bb6530000&locations=2324266930e31001c8954628329e0000&locations=2324266930e31001c8955b403f2c0000&locations=2324266930e31001c895570383370000&locations=2324266930e31001c895506595b80000&locations=893afec753c61000b7fd7b3c19b50000&timeType=21cf1a5c7b78100a88fbafffdaca0003&jobFamilyGroup=862f1dc2c8d31001c8cdb9c6ab430000&workerSubType=862f1dc2c8d31001c80a51915b0e0001", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/60", logo: "/Company_Images/SeaWorld.jpg" },
  { name: "SeatGeek (Remote)",    url: "https://seatgeek.com/jobs?departments=softwareengineering&locations=remote-unitedstates",                                                                                                                                                                                  color: "from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:border-orange-400/60", logo: "/Company_Images/SeatGeek.jpg" },
  { name: "SeatGeek (NY)",        url: "https://seatgeek.com/jobs?departments=softwareengineering&locations=remote-unitedstates%2Cnewyorknewyork",                                                                                                                                                                color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/60",  logo: "/Company_Images/SeatGeek.jpg" },
  { name: "StubHub",              url: "https://job-boards.greenhouse.io/stubhubinc?departments%5B%5D=4034328101",                                                                                                                                                                                                color: "from-lime-500/20 to-lime-600/10 border-lime-500/30 hover:border-lime-400/60",   logo: "/Company_Images/StubHub.jpg" },
  { name: "AXS",                  url: "https://job-boards.greenhouse.io/axs?offices%5B%5D=4040814002&departments%5B%5D=4004703002",                                                                                                                                                                               color: "from-sky-500/20 to-sky-600/10 border-sky-500/30 hover:border-sky-400/60",      logo: "/Company_Images/AXS.jpg" },
  { name: "CLEAR",                url: "https://www.clearme.com/careers",                                                                                                                                                                                                                                       color: "from-blue-400/20 to-blue-500/10 border-blue-400/30 hover:border-blue-300/60",  logo: "/Company_Images/CLEAR.jpg" },
  { name: "Flywire",              url: "https://www.flywire.com/company/careers/dept/5dacb2c3-6677-425c-b164-530d092d8ce9",                                                                                                                                                                                       color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400/60", logo: "/Company_Images/Flywire.jpg" },
  { name: "Lyft",                 url: "https://www.lyft.com/careers#openings?category=software%2520engineering",                                                                                                                                                                                                color: "from-pink-500/20 to-pink-600/10 border-pink-500/30 hover:border-pink-400/60",  logo: "/Company_Images/Lyft.jpg" },
  { name: "Uber Freight",         url: "https://www.uber.com/us/en/careers/list/?department=Engineering",                                                                                                                                                                                                         color: "from-slate-400/20 to-slate-500/10 border-slate-400/30 hover:border-slate-300/60", logo: "/Company_Images/UberFreight.jpg" },
];

const AI_AGENTIC_COMPANIES: Company[] = [
  { name: "Anthropic",           url: "https://www.anthropic.com/careers",                                  color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/60",      logo: "/Company_Images/Anthropic.ico" },
  { name: "OpenAI",              url: "https://jobs.ashbyhq.com/openai",                                    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/60", logo: "/Company_Images/OpenAI.ico" },
  { name: "Cursor",              url: "https://jobs.ashbyhq.com/cursor",                                    color: "from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-400/60",  logo: "/Company_Images/Cursor.ico" },
  { name: "Notion",              url: "https://jobs.ashbyhq.com/notion",                                    color: "from-slate-500/20 to-slate-600/10 border-slate-500/30 hover:border-slate-400/60",     logo: "/Company_Images/Notion.ico" },
  { name: "Zapier",              url: "https://jobs.ashbyhq.com/zapier",                                    color: "from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:border-orange-400/60",  logo: "/Company_Images/Zapier.ico" },
  { name: "LangChain",           url: "https://jobs.ashbyhq.com/langchain",                                 color: "from-green-500/20 to-green-600/10 border-green-500/30 hover:border-green-400/60",     logo: "/Company_Images/LangChain.ico" },
  { name: "Cohere",              url: "https://jobs.ashbyhq.com/cohere",                                    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60",         logo: "/Company_Images/Cohere.ico" },
  { name: "Mistral AI",          url: "https://jobs.ashbyhq.com/mistral",                                   color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 hover:border-indigo-400/60",  logo: "/Company_Images/MistralAI.ico" },
  { name: "Hebbia",              url: "https://jobs.ashbyhq.com/hebbia-ai",                                 color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400/60",  logo: "/Company_Images/Hebbia.ico" },
  { name: "Harvey AI",           url: "https://jobs.ashbyhq.com/harvey",                                    color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-400/60",         logo: "/Company_Images/HarveyAI.ico" },
  { name: "Sierra AI",           url: "https://jobs.ashbyhq.com/sierra",                                    color: "from-teal-500/20 to-teal-600/10 border-teal-500/30 hover:border-teal-400/60",         logo: "/Company_Images/SierraAI.ico" },
  { name: "Ema",                 url: "https://jobs.ashbyhq.com/ema",                                       color: "from-pink-500/20 to-pink-600/10 border-pink-500/30 hover:border-pink-400/60",         logo: "/Company_Images/Ema.ico" },
  { name: "Adept AI",            url: "https://jobs.ashbyhq.com/adept",                                     color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 hover:border-rose-400/60",         logo: "/Company_Images/AdeptAI.ico" },
  { name: "Cognition AI",        url: "https://jobs.ashbyhq.com/cognition",                                 color: "from-sky-500/20 to-sky-600/10 border-sky-500/30 hover:border-sky-400/60",             logo: "/Company_Images/CognitionAI.ico" },
  { name: "Dust.tt",             url: "https://jobs.ashbyhq.com/dust",                                      color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 hover:border-yellow-400/60",  logo: "/Company_Images/Dusttt.ico" },
  { name: "Linear",              url: "https://jobs.ashbyhq.com/linear",                                    color: "from-violet-600/20 to-violet-700/10 border-violet-600/30 hover:border-violet-500/60",  logo: "/Company_Images/Linear.ico" },
  { name: "Retool",              url: "https://jobs.ashbyhq.com/retool",                                    color: "from-amber-600/20 to-amber-700/10 border-amber-600/30 hover:border-amber-500/60",     logo: "/Company_Images/Retool.ico" },
  { name: "Writer",              url: "https://jobs.ashbyhq.com/writer",                                    color: "from-lime-500/20 to-lime-600/10 border-lime-500/30 hover:border-lime-400/60",         logo: "/Company_Images/Writer.ico" },
  { name: "Runway ML",           url: "https://jobs.ashbyhq.com/runwayml",                                  color: "from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-500/30 hover:border-fuchsia-400/60", logo: "/Company_Images/RunwayML.ico" },
  { name: "Pathos AI",           url: "https://jobs.ashbyhq.com/pathosai",                                  color: "from-red-500/20 to-red-600/10 border-red-500/30 hover:border-red-400/60",             logo: "/Company_Images/Anthropic.ico" },
  { name: "Slack",               url: "https://jobs.ashbyhq.com/slack",                                     color: "from-purple-600/20 to-purple-700/10 border-purple-600/30 hover:border-purple-500/60",  logo: "/Company_Images/Slack.ico" },
  { name: "Workato",             url: "https://job-boards.greenhouse.io/workato",                           color: "from-blue-600/20 to-blue-700/10 border-blue-600/30 hover:border-blue-500/60",         logo: "/Company_Images/Workato.ico" },
  { name: "Make (Celonis US)",   url: "https://job-boards.greenhouse.io/celonis",                           color: "from-green-600/20 to-green-700/10 border-green-600/30 hover:border-green-500/60",     logo: "/Company_Images/Make.ico" },
  { name: "Glean",               url: "https://job-boards.greenhouse.io/gleanwork",                         color: "from-orange-600/20 to-orange-700/10 border-orange-600/30 hover:border-orange-500/60",  logo: "/Company_Images/Glean.ico" },
  { name: "Moveworks",           url: "https://job-boards.greenhouse.io/moveworks",                         color: "from-indigo-600/20 to-indigo-700/10 border-indigo-600/30 hover:border-indigo-500/60",  logo: "/Company_Images/Moveworks.ico" },
  { name: "Weights & Biases",    url: "https://wandb.ai/careers",                                         color: "from-yellow-600/20 to-yellow-700/10 border-yellow-600/30 hover:border-yellow-500/60",  logo: "/Company_Images/WeightsAndBiases.svg" },
  { name: "Codeium / Windsurf",  url: "https://codeium.com/careers",                                       color: "from-emerald-600/20 to-emerald-700/10 border-emerald-600/30 hover:border-emerald-500/60", logo: "/Company_Images/Codeium.ico" },
  { name: "Salesforce",          url: "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site",     color: "from-sky-600/20 to-sky-700/10 border-sky-600/30 hover:border-sky-500/60",             logo: "/Company_Images/Salesforce.ico" },
  { name: "Microsoft",           url: "https://careers.microsoft.com/v2/global/en/home.html",               color: "from-blue-700/20 to-blue-800/10 border-blue-700/30 hover:border-blue-600/60",         logo: "/Company_Images/Microsoft.ico" },
  { name: "ServiceNow",          url: "https://careers.servicenow.com/en/",                                 color: "from-teal-600/20 to-teal-700/10 border-teal-600/30 hover:border-teal-500/60",         logo: "/Company_Images/ServiceNow.ico" },
];

const GENERAL_COMPANIES: Company[] = [
  // ── FAANG ──────────────────────────────────────────────────────────────────
  { name: "Amazon",         url: "https://www.amazon.jobs/en/teams/software-development",                                             color: "from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:border-orange-400/60", logo: "/Company_Images/Amazon.ico" },
  { name: "Google",         url: "https://careers.google.com/jobs/results/?category=SOFTWARE_ENGINEERING",                            color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60",         logo: "/Company_Images/Google.ico" },
  { name: "Meta",           url: "https://www.metacareers.com/areas-of-work/engineering/",                                            color: "from-sky-500/20 to-sky-600/10 border-sky-500/30 hover:border-sky-400/60",             logo: "/Company_Images/Meta.ico" },
  { name: "Apple",          url: "https://jobs.apple.com/en-us/search?team=apps-and-frameworks-SFTWR-AF",                             color: "from-slate-500/20 to-slate-600/10 border-slate-500/30 hover:border-slate-400/60",     logo: "/Company_Images/Apple.ico" },
  // ── Greenhouse ─────────────────────────────────────────────────────────────
  { name: "Snap Inc.",      url: "https://careers.snap.com/jobs?type=Engineering",                                                    color: "from-yellow-400/20 to-yellow-500/10 border-yellow-400/30 hover:border-yellow-300/60", logo: "/Company_Images/Snapchat.png" },
  { name: "Stripe",         url: "https://stripe.com/jobs/search?remote_locations=North+America--US",                                 color: "from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-400/60", logo: "/Company_Images/Stripe.ico" },
  { name: "Databricks",     url: "https://www.databricks.com/company/careers/open-positions",                                         color: "from-red-500/20 to-red-600/10 border-red-500/30 hover:border-red-400/60",             logo: "/Company_Images/Databricks.ico" },
  { name: "Twilio",         url: "https://www.twilio.com/en-us/company/jobs",                                                         color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 hover:border-rose-400/60",         logo: "/Company_Images/Twilio.ico" },
  { name: "Cloudflare",     url: "https://www.cloudflare.com/careers/jobs/",                                                          color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-400/60",     logo: "/Company_Images/Cloudflare.ico" },
  { name: "Datadog",        url: "https://careers.datadoghq.com/all-jobs/",                                                           color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400/60", logo: "/Company_Images/Datadog.ico" },
  { name: "MongoDB",        url: "https://www.mongodb.com/careers/departments/engineering",                                           color: "from-green-500/20 to-green-600/10 border-green-500/30 hover:border-green-400/60",     logo: "/Company_Images/MongoDB.ico" },
  { name: "Riot Games",     url: "https://www.riotgames.com/en/work-with-us/jobs#department=Engineering",                             color: "from-red-600/20 to-red-700/10 border-red-600/30 hover:border-red-500/60",             logo: "/Company_Images/RiotGames.ico" },
  { name: "Vercel",         url: "https://vercel.com/careers",                                                                        color: "from-slate-400/20 to-slate-500/10 border-slate-400/30 hover:border-slate-300/60",     logo: "/Company_Images/Vercel.ico" },
  { name: "Instacart",      url: "https://instacart.careers/current-openings/",                                                       color: "from-green-600/20 to-green-700/10 border-green-600/30 hover:border-green-500/60",     logo: "/Company_Images/Instacart.ico" },
  { name: "Pinterest",      url: "https://www.pinterestcareers.com/jobs/?team=Engineering",                                           color: "from-rose-600/20 to-rose-700/10 border-rose-600/30 hover:border-rose-500/60",         logo: "/Company_Images/Pinterest.ico" },
  { name: "DoorDash",       url: "https://boards.greenhouse.io/doordashglobal",                                          color: "from-red-500/20 to-red-600/10 border-red-500/30 hover:border-red-400/60",             logo: "/Company_Images/DoorDash.ico" },
  { name: "Figma",          url: "https://www.figma.com/careers/#job-openings",                                                       color: "from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-500/30 hover:border-fuchsia-400/60", logo: "/Company_Images/Figma.ico" },
  { name: "Brex",           url: "https://www.brex.com/careers",                                                                      color: "from-teal-500/20 to-teal-600/10 border-teal-500/30 hover:border-teal-400/60",         logo: "/Company_Images/Brex.ico" },
  // ── Ashby ──────────────────────────────────────────────────────────────────
  { name: "Ramp",           url: "https://jobs.ashbyhq.com/ramp",                                                                     color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400/60", logo: "/Company_Images/Ramp.ico" },
  { name: "Confluent",      url: "https://jobs.ashbyhq.com/confluent",                                                                color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 hover:border-indigo-400/60", logo: "/Company_Images/Confluent.ico" },
  { name: "Snowflake",      url: "https://jobs.ashbyhq.com/snowflake",                                                                color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-400/60",         logo: "/Company_Images/Snowflake.ico" },
  // ── Workday ────────────────────────────────────────────────────────────────
  { name: "Adobe",          url: "https://adobe.wd5.myworkdayjobs.com/external_experienced",                                          color: "from-red-600/20 to-red-700/10 border-red-600/30 hover:border-red-500/60",             logo: "/Company_Images/Adobe.ico" },
  { name: "Intuit",         url: "https://intuit.wd1.myworkdayjobs.com/Intuit_Careers",                                               color: "from-blue-600/20 to-blue-700/10 border-blue-600/30 hover:border-blue-500/60",         logo: "/Company_Images/Intuit.png" },
  { name: "Qualcomm",       url: "https://qualcomm.wd5.myworkdayjobs.com/External",                                                   color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60",         logo: "/Company_Images/Qualcomm.ico" },
  { name: "PayPal",         url: "https://paypal.wd1.myworkdayjobs.com/jobs",                                                         color: "from-sky-600/20 to-sky-700/10 border-sky-600/30 hover:border-sky-500/60",             logo: "/Company_Images/PayPal.ico" },
  { name: "Capital One",    url: "https://capitalone.wd12.myworkdayjobs.com/Capital_One",                                              color: "from-red-700/20 to-red-800/10 border-red-700/30 hover:border-red-600/60",             logo: "/Company_Images/CapitalOne.ico" },
  { name: "JPMorgan Chase", url: "https://careers.jpmorgan.com/us/en/jobs?category=Technology",                                                     color: "from-slate-600/20 to-slate-700/10 border-slate-600/30 hover:border-slate-500/60",     logo: "/Company_Images/JPMorganChase.ico" },
  { name: "Shopify",        url: "https://www.shopify.com/careers",                                                                   color: "from-green-600/20 to-green-700/10 border-green-600/30 hover:border-green-500/60",     logo: "/Company_Images/Shopify.ico" },
  { name: "Zendesk",        url: "https://zendesk.wd1.myworkdayjobs.com/zendesk",                                                     color: "from-lime-600/20 to-lime-700/10 border-lime-600/30 hover:border-lime-500/60",         logo: "/Company_Images/Zendesk.ico" },
];

const TABS: { id: CompanyCategory; label: string }[] = [
  { id: "travel", label: "✈️ Travel Ticketing" },
  { id: "ai-agentic", label: "🤖 AI & Agentic" },
  { id: "general", label: "🌐 General Full Stack" },
  { id: "hiring-cafe", label: "☕ Hiring Cafe" },
];

const TIME_FILTERS: { id: TimeFilter; label: string; ms: number }[] = [
  { id: "2h",  label: "⚡ Last 2 hrs",  ms:  2 * 3_600_000 },
  { id: "12h", label: "Last 12 hrs", ms: 12 * 3_600_000 },
  { id: "1d",  label: "Last 24 hrs", ms: 24 * 3_600_000 },
  { id: "2d",  label: "Last 48 hrs", ms: 48 * 3_600_000 },
];

function filterByTime(jobs: Job[], filter: TimeFilter): Job[] {
  const { ms } = TIME_FILTERS.find((f) => f.id === filter)!;
  const now = Date.now();
  return jobs.filter(
    (j) => j.fetchedAt && now - new Date(j.fetchedAt).getTime() <= ms
  );
}

function filterBySearch(jobs: Job[], q: string): Job[] {
  if (!q.trim()) return jobs;
  const lower = q.toLowerCase();
  return jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(lower) ||
      j.company.toLowerCase().includes(lower)
  );
}

function filterByLocation(jobs: Job[], filter: LocationFilter): Job[] {
  if (filter === "all") return jobs;
  return jobs.filter((j) => {
    const combined = (j.location + " " + j.description).toLowerCase();
    if (filter === "remote") return combined.includes("remote");
    return !combined.includes("remote") && !combined.includes("hybrid");
  });
}

function sortJobs(
  jobs: Job[],
  mode: SortMode,
  scores: Map<string, number>
): Job[] {
  const arr = [...jobs];
  switch (mode) {
    case "ats":
      return arr.sort((a, b) => (scores.get(b.url) ?? 0) - (scores.get(a.url) ?? 0));
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return arr.sort(
        (a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
      );
  }
}

function inferSeniority(title: string): "senior" | "mid" | "junior" {
  const t = title.toLowerCase();
  if (/staff|principal|distinguished|vp|director/.test(t)) return "senior";
  if (/senior|sr\.|lead/.test(t)) return "senior";
  if (/junior|jr\.|entry|associate/.test(t)) return "junior";
  return "mid";
}

function inferLocationType(
  location: string,
  description: string
): "remote" | "hybrid" | "onsite" | "unknown" {
  const combined = (location + " " + description).toLowerCase();
  if (combined.includes("remote")) return "remote";
  if (combined.includes("hybrid")) return "hybrid";
  if (location.trim().length > 0) return "onsite";
  return "unknown";
}

function computeWhyApply(job: Job, ats: AtsResult): string[] {
  const reasons: string[] = [];
  if (ats.score >= 80) reasons.push("Excellent resume fit — keyword-dense JD match");
  else if (ats.score >= 70) reasons.push("Strong match — your stack aligns with the core requirements");
  else if (ats.score >= 60) reasons.push("Good foundation — highlight your transferable skills");
  const seniority = inferSeniority(job.title);
  if (seniority === "senior") reasons.push("Senior/Lead role — your cross-team experience is a differentiator");
  else if (seniority === "mid") reasons.push("Mid-level scope matches your current experience band");
  const top = ats.matched.slice(0, 4);
  if (top.length) reasons.push(`Direct skill overlap: ${top.join(", ")}`);
  if (ats.missing.length > 0) reasons.push(`Cover in your CL: ${ats.missing.slice(0, 2).join(", ")}`);
  return reasons;
}

/** Extract salary string embedded at the start of a hiring.cafe description */
function extractSalary(desc: string): string {
  const m = desc?.match(/^Salary:\s*(\$[\d,]+[kKmM]?(?:\s*[-–]—\s*\$[\d,]+[kKmM]?)?(?:\s*\/\s*(?:yr|year|hr|hour))?)/m);
  if (m) return m[1];
  // also try inline pattern
  const m2 = desc?.match(/\$[\d,]+[kKmM]?\s*[-–—]\s*\$[\d,]+[kKmM]?(?:\s*\/\s*(?:yr|year|hr))/);
  return m2?.[0] ?? "";
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
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company.logo}
            alt=""
            width={24}
            height={24}
            className="rounded-sm shrink-0 object-contain bg-white/10"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span className="font-semibold text-slate-200 text-sm leading-tight group-hover:text-white transition-colors truncate">
            {company.name}
          </span>
        </div>
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

// ── ATS circular ring ─────────────────────────────────────────────────────────
function AtsRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 5) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  const color =
    score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#94a3b8";
  const trackColor =
    score >= 70
      ? "rgba(16,185,129,0.12)"
      : score >= 50
      ? "rgba(245,158,11,0.12)"
      : "rgba(148,163,184,0.10)";
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="relative z-10 text-[9px] font-bold leading-none" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}

// ── ATS insight panel ─────────────────────────────────────────────────────────
function AtsInsightPanel({ ats, job }: { ats: AtsResult; job: Job }) {
  const reasons = computeWhyApply(job, ats);
  const seniority = inferSeniority(job.title);
  const locType = inferLocationType(job.location, job.description);
  const seniorityColors: Record<string, string> = {
    senior: "bg-violet-500/15 text-violet-300 border-violet-500/25",
    mid:    "bg-blue-500/15 text-blue-300 border-blue-500/25",
    junior: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  };
  const locColors: Record<string, string> = {
    remote:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    hybrid:  "bg-amber-500/15 text-amber-400 border-amber-500/25",
    onsite:  "bg-sky-500/15 text-sky-400 border-sky-500/25",
    unknown: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  };
  return (
    <div className="mt-3 pt-3 border-t dark:border-white/5 border-slate-200 space-y-3">
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${seniorityColors[seniority]}`}>
          {seniority === "senior" ? "👑 " : seniority === "junior" ? "🌱 " : "⚡ "}{seniority}
        </span>
        {locType !== "unknown" && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${locColors[locType]}`}>
            {locType === "remote" ? "🏠 " : locType === "hybrid" ? "🔀 " : "🏢 "}{locType}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
          ATS score <AtsRing score={ats.score} size={32} />
        </span>
      </div>
      {reasons.length > 0 && (
        <div className="rounded-lg border dark:border-white/5 border-slate-200 dark:bg-white/[0.02] bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Why apply</p>
          <ul className="space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] dark:text-slate-400 text-slate-600">
                <span className="shrink-0 text-indigo-400">›</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-[10px] text-slate-600 mr-0.5">Matched:</span>
        {ats.matched.slice(0, 8).map((kw) => (
          <span key={kw} className="rounded px-1.5 py-0.5 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{kw}</span>
        ))}
        {ats.missing.length > 0 && (
          <>
            <span className="text-[10px] text-slate-600 ml-1 mr-0.5">Gap:</span>
            {ats.missing.slice(0, 4).map((kw) => (
              <span key={kw} className="rounded px-1.5 py-0.5 text-[9px] bg-slate-500/10 text-slate-500 border border-slate-500/20">{kw}</span>
            ))}
          </>
        )}
      </div>
      {job.description && (
        <div className="text-xs dark:text-slate-400 text-slate-500 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-1">
          {job.description}
        </div>
      )}
    </div>
  );
}

export default function CompaniesTab() {
  const [activeCategory, setActiveCategory] = useState<CompanyCategory>("travel");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("12h");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [generating, setGenerating] = useState<Record<string, "resume" | "cover">>({});
  const [bulkState, setBulkState] = useState<{ running: boolean; done: number; total: number; errors: number }>(
    { running: false, done: 0, total: 0, errors: 0 }
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("newest");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [archiving, setArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<{ archived: number; kept: number } | null>(null);

  // Pre-compute ATS scores for all jobs with descriptions (keyed by URL)
  const atsScores = new Map<string, number>(
    resume
      ? jobs
          .filter((j) => j.description)
          .map((j) => [j.url, calculateAtsScore(j.description, resume).score])
      : []
  );

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

  const handleArchive = useCallback(async () => {
    setArchiving(true);
    setArchiveResult(null);
    try {
      const res = await fetch("/api/jobs/archive", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? "Archive failed");
        return;
      }
      const data = await res.json() as { archived: number; kept: number };
      setArchiveResult(data);
      await fetchJobs();
    } finally {
      setArchiving(false);
    }
  }, [fetchJobs]);

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

  // Apply time filter first
  const filteredJobs = filterByTime(jobs, timeFilter);
  const newJobs = filterByTime(jobs, "2h");
  const jobsByCompany = filteredJobs.reduce<Record<string, Job[]>>((acc, job) => {
    (acc[job.company] ??= []).push(job);
    return acc;
  }, {});
  const newByCompany = newJobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.company] = (acc[job.company] ?? 0) + 1;
    return acc;
  }, {});

  const rawSelectedJobs = selectedCompany ? (jobsByCompany[selectedCompany] ?? []) : [];
  const selectedJobs = sortJobs(
    filterByLocation(filterBySearch(rawSelectedJobs, searchQuery), locationFilter),
    sortBy,
    atsScores
  );
  const totalFiltered = filteredJobs.length;

  // Jobs with ATS >= 70% that have descriptions (auto-gen candidates)
  const topMatches = resume
    ? jobs
        .filter((j) => j.description)
        .map((j) => ({ job: j, ats: calculateAtsScore(j.description, resume) }))
        .filter(({ ats }) => ats.score >= 70)
        .sort((a, b) => b.ats.score - a.ats.score)
    : [];

  const handleBulkGenerate = useCallback(async () => {
    if (topMatches.length === 0 || bulkState.running) return;
    setBulkState({ running: true, done: 0, total: topMatches.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < topMatches.length; i++) {
      const { job } = topMatches[i];
      try {
        const res = await fetch("/api/resume/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: job.title,
            company: job.company,
            description: job.description,
            type: "resume",
          }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${job.company.replace(/\s+/g, "_")}_${job.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}_Resume.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          // Small delay between downloads so browser doesn't block
          await new Promise((r) => setTimeout(r, 800));
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
      setBulkState((prev) => ({ ...prev, done: i + 1, errors }));
    }
    setBulkState({ running: false, done: topMatches.length, total: topMatches.length, errors });
  }, [topMatches, bulkState.running]);

  return (
    <section className="rounded-2xl border dark:border-white/8 border-slate-200 dark:bg-white/[0.03] bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold dark:text-slate-100 text-slate-900">Companies</h2>
          <p className="mt-1 text-sm text-slate-500">
            Job portals organised by domain — click a card to see open engineering roles.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            {/* Archive old jobs */}
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving || loading}
              title="Move jobs older than 2 days to 'Old Jobs' sheet"
              className="flex items-center gap-1.5 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-3 py-1.5 text-xs text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/30 transition-colors disabled:opacity-40"
            >
              {archiving ? (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="21 8 21 21 3 21 3 8"/><rect width="18" height="5" x="3" y="3" rx="1"/><line x1="10" x2="14" y1="12" y2="12"/>
                </svg>
              )}
              Archive
            </button>
            {/* Refresh */}
            <button
              type="button"
              onClick={fetchJobs}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 hover:text-slate-600 dark:hover:bg-white/10 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={["h-3 w-3", loading ? "animate-spin" : ""].join(" ")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {archiveResult && (
            <span className="text-[10px] text-amber-400">✓ Archived {archiveResult.archived} old jobs</span>
          )}
          {lastFetched && !loading && !archiveResult && (
            <span className="text-[10px] text-slate-600">{jobs.length} total · updated {lastFetched}</span>
          )}
          {error && (
            <span className="text-[10px] text-amber-500">
              ⚠ {error === "Google Sheets not configured" ? "Sheets not configured yet" : error}
            </span>
          )}
        </div>
      </div>

      {/* ── Auto-Generate Top Matches banner ── */}
      {topMatches.length > 0 && !loading && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-300">
                🎯 {topMatches.length} high-match job{topMatches.length !== 1 ? "s" : ""} found (≥70% ATS)
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {topMatches.slice(0, 3).map(({ job, ats }) => (
                <span key={job.url} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                  <AtsRing score={ats.score} size={18} />
                  {job.company} — {job.title.slice(0, 30)}
                </span>
              ))}
              {topMatches.length > 3 && <span className="text-[10px] text-slate-500">+{topMatches.length - 3} more</span>}
              </div>
            </div>
            <button
              type="button"
              disabled={bulkState.running}
              onClick={handleBulkGenerate}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 transition-all disabled:opacity-60"
            >
              {bulkState.running ? (
                <>
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                  {bulkState.done}/{bulkState.total}
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Auto-Generate All
                </>
              )}
            </button>
          </div>
          {bulkState.done > 0 && !bulkState.running && (
            <p className="text-[11px] text-slate-500">
              ✓ {bulkState.done - bulkState.errors} PDF{bulkState.done - bulkState.errors !== 1 ? "s" : ""} downloaded
              {bulkState.errors > 0 ? ` · ${bulkState.errors} failed` : ""}
            </p>
          )}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="mb-4 flex gap-1 rounded-xl dark:bg-white/5 bg-slate-100 p-1">
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
          const count = filterByTime(jobs, id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTimeFilter(id)}
              className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium border transition-all duration-150",
                timeFilter === id
                  ? "bg-indigo-500/25 text-indigo-300 border-indigo-500/50 shadow"
                  : "dark:bg-white/5 bg-slate-100 text-slate-500 dark:border-white/10 border-slate-200 hover:text-slate-300 dark:hover:border-white/20 hover:border-slate-300",
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
                    : "dark:bg-white/10 bg-slate-200 text-slate-400",
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
                    setSearchQuery("");
                    setSortBy("newest");
                    setLocationFilter("all");
                  }}
              />
            ))}
          </div>

          {/* Jobs panel */}
          {selectedCompany && (
            <div className="mt-5 rounded-xl border dark:border-white/10 border-slate-200 dark:bg-white/[0.03] bg-white overflow-hidden shadow-sm">
              {/* Panel header */}
              <div className="flex items-center justify-between border-b dark:border-white/8 border-slate-200 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold dark:text-slate-200 text-slate-800">
                    {selectedCompany}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {rawSelectedJobs.length === 0
                      ? `No new roles in the ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`
                      : `${rawSelectedJobs.length} engineering ${rawSelectedJobs.length === 1 ? "role" : "roles"} · ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`}
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

              {/* Filter/search bar */}
              {rawSelectedJobs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b dark:border-white/5 border-slate-100">
                  <div className="relative flex-1 min-w-[160px]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search roles…"
                      className="w-full rounded-lg border dark:border-white/8 border-slate-200 dark:bg-white/5 bg-slate-50 pl-7 pr-3 py-1.5 text-xs dark:text-slate-300 text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="flex gap-1">
                    {(["all", "remote", "onsite"] as LocationFilter[]).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocationFilter(loc)}
                        className={[
                          "rounded-full px-2.5 py-1 text-[10px] font-medium border transition-all",
                          locationFilter === loc
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                            : "dark:bg-white/5 bg-slate-100 text-slate-500 dark:border-white/10 border-slate-200 hover:text-slate-300",
                        ].join(" ")}
                      >
                        {loc === "all" ? "All" : loc === "remote" ? "🏠 Remote" : "🏢 Onsite"}
                      </button>
                    ))}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortMode)}
                    className="rounded-lg border dark:border-white/8 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1.5 text-[10px] dark:text-slate-400 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value="newest">Newest first</option>
                    <option value="ats">Highest ATS</option>
                    <option value="title">Title A–Z</option>
                  </select>
                  {selectedJobs.length !== rawSelectedJobs.length && (
                    <span className="text-[10px] text-slate-500">{selectedJobs.length}/{rawSelectedJobs.length} shown</span>
                  )}
                </div>
              )}

              {/* Job list */}
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-600 text-sm">Loading jobs…</div>
              ) : rawSelectedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <p className="text-sm">
                    {error ? "Configure Google Sheets to see live jobs" : `No new roles in the ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()} — try a wider window`}
                  </p>
                </div>
              ) : selectedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600">
                  <p className="text-sm">No roles match your filters</p>
                  <button type="button" onClick={() => { setSearchQuery(""); setLocationFilter("all"); }} className="text-xs text-indigo-400 hover:text-indigo-300">Clear filters</button>
                </div>
              ) : (
                <ul className="divide-y dark:divide-white/5 divide-slate-100 max-h-[520px] overflow-y-auto">
                  {selectedJobs.map((job, i) => {
                    const isNew = job.fetchedAt &&
                      Date.now() - new Date(job.fetchedAt).getTime() <= 2 * 3_600_000;
                    const isExpanded = expandedJob === job.url;
                    const ats = resume && job.description
                      ? calculateAtsScore(job.description, resume)
                      : null;
                    const resumeKey = `${job.url}:resume`;
                    const coverKey  = `${job.url}:cover`;
                    const genResume = !!generating[resumeKey];
                    const genCover  = !!generating[coverKey];
                    return (
                      <li key={i} className={["px-5 py-3 dark:hover:bg-white/[0.03] hover:bg-slate-50 transition-colors", isExpanded ? "dark:bg-white/[0.02] bg-slate-50/80" : ""].join(" ")}>
                        <div className="flex items-center gap-2">
                          {ats && (
                            <div className="shrink-0" title={`ATS score: ${ats.score}%`}>
                              <AtsRing score={ats.score} size={36} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm dark:text-slate-200 text-slate-800 font-medium truncate">{job.title}</p>
                              {isNew && (
                                <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">NEW</span>
                              )}
                              {ats && ats.score >= 70 && (
                                <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/25 uppercase tracking-wide">✓ Strong fit</span>
                              )}
                            </div>
                            {job.location && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{job.location}</p>
                            )}
                          </div>
                          {job.fetchedAt && (
                            <span className="text-[10px] text-slate-600 shrink-0 hidden sm:block">{timeAgo(job.fetchedAt)}</span>
                          )}
                          {job.description && (
                            <button type="button" title="Generate tailored resume PDF" disabled={genResume || genCover} onClick={() => handleGenerate(job, "resume")}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all disabled:opacity-40">
                              {genResume ? "…" : "📄 CV"}
                            </button>
                          )}
                          {job.description && (
                            <button type="button" title="Generate cover letter PDF" disabled={genResume || genCover} onClick={() => handleGenerate(job, "cover")}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all disabled:opacity-40">
                              {genCover ? "…" : "✉ CL"}
                            </button>
                          )}
                          {job.description && (
                            <button type="button" onClick={() => setExpandedJob(isExpanded ? null : job.url)}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 dark:hover:text-slate-200 hover:text-slate-600 dark:hover:bg-white/10 hover:bg-slate-100 transition-all"
                              aria-label={isExpanded ? "Hide details" : "Show details"}>
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          )}
                          <a href={job.url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-3 py-1 text-xs text-slate-400 hover:text-slate-100 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all">
                            Apply
                          </a>
                        </div>
                        {isExpanded && ats && <AtsInsightPanel ats={ats} job={job} />}
                        {isExpanded && !ats && job.description && (
                          <div className="mt-3 pt-3 border-t dark:border-white/5 border-slate-200">
                            <div className="text-xs dark:text-slate-400 text-slate-500 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-1">{job.description}</div>
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
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {AI_AGENTIC_COMPANIES.map((company) => (
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
                    setSearchQuery("");
                    setSortBy("newest");
                    setLocationFilter("all");
                  }}
              />
            ))}
          </div>

          {/* Jobs panel */}
          {selectedCompany && AI_AGENTIC_COMPANIES.some(c => c.name === selectedCompany) && (
            <div className="mt-5 rounded-xl border dark:border-white/10 border-slate-200 dark:bg-white/[0.03] bg-white overflow-hidden shadow-sm">
              {/* Panel header */}
              <div className="flex items-center justify-between border-b dark:border-white/8 border-slate-200 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold dark:text-slate-200 text-slate-800">
                    {selectedCompany}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {rawSelectedJobs.length === 0
                      ? `No new roles in the ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`
                      : `${rawSelectedJobs.length} engineering ${rawSelectedJobs.length === 1 ? "role" : "roles"} · ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`}
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

              {/* Filter/search bar */}
              {rawSelectedJobs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b dark:border-white/5 border-slate-100">
                  <div className="relative flex-1 min-w-[160px]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search roles…"
                      className="w-full rounded-lg border dark:border-white/8 border-slate-200 dark:bg-white/5 bg-slate-50 pl-7 pr-3 py-1.5 text-xs dark:text-slate-300 text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="flex gap-1">
                    {(["all", "remote", "onsite"] as LocationFilter[]).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocationFilter(loc)}
                        className={[
                          "rounded-full px-2.5 py-1 text-[10px] font-medium border transition-all",
                          locationFilter === loc
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                            : "dark:bg-white/5 bg-slate-100 text-slate-500 dark:border-white/10 border-slate-200 hover:text-slate-300",
                        ].join(" ")}
                      >
                        {loc === "all" ? "All" : loc === "remote" ? "🏠 Remote" : "🏢 Onsite"}
                      </button>
                    ))}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortMode)}
                    className="rounded-lg border dark:border-white/8 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1.5 text-[10px] dark:text-slate-400 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value="newest">Newest first</option>
                    <option value="ats">Highest ATS</option>
                    <option value="title">Title A–Z</option>
                  </select>
                  {selectedJobs.length !== rawSelectedJobs.length && (
                    <span className="text-[10px] text-slate-500">{selectedJobs.length}/{rawSelectedJobs.length} shown</span>
                  )}
                </div>
              )}

              {/* Job list */}
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-600 text-sm">Loading jobs…</div>
              ) : rawSelectedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <p className="text-sm">
                    {error ? "Configure Google Sheets to see live jobs" : `No new roles in the ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()} — try a wider window`}
                  </p>
                </div>
              ) : selectedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600">
                  <p className="text-sm">No roles match your filters</p>
                  <button type="button" onClick={() => { setSearchQuery(""); setLocationFilter("all"); }} className="text-xs text-indigo-400 hover:text-indigo-300">Clear filters</button>
                </div>
              ) : (
                <ul className="divide-y dark:divide-white/5 divide-slate-100 max-h-[520px] overflow-y-auto">
                  {selectedJobs.map((job, i) => {
                    const isNew = job.fetchedAt &&
                      Date.now() - new Date(job.fetchedAt).getTime() <= 2 * 3_600_000;
                    const isExpanded = expandedJob === job.url;
                    const ats = resume && job.description
                      ? calculateAtsScore(job.description, resume)
                      : null;
                    const resumeKey = `${job.url}:resume`;
                    const coverKey  = `${job.url}:cover`;
                    const genResume = !!generating[resumeKey];
                    const genCover  = !!generating[coverKey];
                    return (
                      <li key={i} className={["px-5 py-3 dark:hover:bg-white/[0.03] hover:bg-slate-50 transition-colors", isExpanded ? "dark:bg-white/[0.02] bg-slate-50/80" : ""].join(" ")}>
                        <div className="flex items-center gap-2">
                          {ats && (
                            <div className="shrink-0" title={`ATS score: ${ats.score}%`}>
                              <AtsRing score={ats.score} size={36} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm dark:text-slate-200 text-slate-800 font-medium truncate">{job.title}</p>
                              {isNew && (
                                <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">NEW</span>
                              )}
                              {ats && ats.score >= 70 && (
                                <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/25 uppercase tracking-wide">✓ Strong fit</span>
                              )}
                            </div>
                            {job.location && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{job.location}</p>
                            )}
                          </div>
                          {job.fetchedAt && (
                            <span className="text-[10px] text-slate-600 shrink-0 hidden sm:block">{timeAgo(job.fetchedAt)}</span>
                          )}
                          {job.description && (
                            <button type="button" title="Generate tailored resume PDF" disabled={genResume || genCover} onClick={() => handleGenerate(job, "resume")}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all disabled:opacity-40">
                              {genResume ? "…" : "📄 CV"}
                            </button>
                          )}
                          {job.description && (
                            <button type="button" title="Generate cover letter PDF" disabled={genResume || genCover} onClick={() => handleGenerate(job, "cover")}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all disabled:opacity-40">
                              {genCover ? "…" : "✉ CL"}
                            </button>
                          )}
                          {job.description && (
                            <button type="button" onClick={() => setExpandedJob(isExpanded ? null : job.url)}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 dark:hover:text-slate-200 hover:text-slate-600 dark:hover:bg-white/10 hover:bg-slate-100 transition-all"
                              aria-label={isExpanded ? "Hide details" : "Show details"}>
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          )}
                          <a href={job.url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-3 py-1 text-xs text-slate-400 hover:text-slate-100 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all">
                            Apply
                          </a>
                        </div>
                        {isExpanded && ats && <AtsInsightPanel ats={ats} job={job} />}
                        {isExpanded && !ats && job.description && (
                          <div className="mt-3 pt-3 border-t dark:border-white/5 border-slate-200">
                            <div className="text-xs dark:text-slate-400 text-slate-500 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-1">{job.description}</div>
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
      {activeCategory === "general" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {GENERAL_COMPANIES.map((company) => (
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
                    setSearchQuery("");
                    setSortBy("newest");
                    setLocationFilter("all");
                  }}
              />
            ))}
          </div>

          {/* Jobs panel */}
          {selectedCompany && GENERAL_COMPANIES.some(c => c.name === selectedCompany) && (
            <div className="mt-5 rounded-xl border dark:border-white/10 border-slate-200 dark:bg-white/[0.03] bg-white overflow-hidden shadow-sm">
              {/* Panel header */}
              <div className="flex items-center justify-between border-b dark:border-white/8 border-slate-200 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold dark:text-slate-200 text-slate-800">
                    {selectedCompany}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {rawSelectedJobs.length === 0
                      ? `No new roles in the ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`
                      : `${rawSelectedJobs.length} engineering ${rawSelectedJobs.length === 1 ? "role" : "roles"} · ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`}
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

              {/* Filter/search bar */}
              {rawSelectedJobs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b dark:border-white/5 border-slate-100">
                  <div className="relative flex-1 min-w-[160px]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search roles…"
                      className="w-full rounded-lg border dark:border-white/8 border-slate-200 dark:bg-white/5 bg-slate-50 pl-7 pr-3 py-1.5 text-xs dark:text-slate-300 text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="flex gap-1">
                    {(["all", "remote", "onsite"] as LocationFilter[]).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocationFilter(loc)}
                        className={[
                          "rounded-full px-2.5 py-1 text-[10px] font-medium border transition-all",
                          locationFilter === loc
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                            : "dark:bg-white/5 bg-slate-100 text-slate-500 dark:border-white/10 border-slate-200 hover:text-slate-300",
                        ].join(" ")}
                      >
                        {loc === "all" ? "All" : loc === "remote" ? "🏠 Remote" : "🏢 Onsite"}
                      </button>
                    ))}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortMode)}
                    className="rounded-lg border dark:border-white/8 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1.5 text-[10px] dark:text-slate-400 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value="newest">Newest first</option>
                    <option value="ats">Highest ATS</option>
                    <option value="title">Title A–Z</option>
                  </select>
                  {selectedJobs.length !== rawSelectedJobs.length && (
                    <span className="text-[10px] text-slate-500">{selectedJobs.length}/{rawSelectedJobs.length} shown</span>
                  )}
                </div>
              )}

              {/* Job list */}
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-600 text-sm">Loading jobs…</div>
              ) : rawSelectedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <p className="text-sm">
                    {error ? "Configure Google Sheets to see live jobs" : `No new roles in the ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()} — try a wider window`}
                  </p>
                </div>
              ) : selectedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600">
                  <p className="text-sm">No roles match your filters</p>
                  <button type="button" onClick={() => { setSearchQuery(""); setLocationFilter("all"); }} className="text-xs text-indigo-400 hover:text-indigo-300">Clear filters</button>
                </div>
              ) : (
                <ul className="divide-y dark:divide-white/5 divide-slate-100 max-h-[520px] overflow-y-auto">
                  {selectedJobs.map((job, i) => {
                    const isNew = job.fetchedAt &&
                      Date.now() - new Date(job.fetchedAt).getTime() <= 2 * 3_600_000;
                    const isExpanded = expandedJob === job.url;
                    const ats = resume && job.description
                      ? calculateAtsScore(job.description, resume)
                      : null;
                    const resumeKey = `${job.url}:resume`;
                    const coverKey  = `${job.url}:cover`;
                    const genResume = !!generating[resumeKey];
                    const genCover  = !!generating[coverKey];
                    return (
                      <li key={i} className={["px-5 py-3 dark:hover:bg-white/[0.03] hover:bg-slate-50 transition-colors", isExpanded ? "dark:bg-white/[0.02] bg-slate-50/80" : ""].join(" ")}>
                        <div className="flex items-center gap-2">
                          {ats && (
                            <div className="shrink-0" title={`ATS score: ${ats.score}%`}>
                              <AtsRing score={ats.score} size={36} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm dark:text-slate-200 text-slate-800 font-medium truncate">{job.title}</p>
                              {isNew && (
                                <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">NEW</span>
                              )}
                              {ats && ats.score >= 70 && (
                                <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/25 uppercase tracking-wide">✓ Strong fit</span>
                              )}
                            </div>
                            {job.location && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{job.location}</p>
                            )}
                          </div>
                          {job.fetchedAt && (
                            <span className="text-[10px] text-slate-600 shrink-0 hidden sm:block">{timeAgo(job.fetchedAt)}</span>
                          )}
                          {job.description && (
                            <button type="button" title="Generate tailored resume PDF" disabled={genResume || genCover} onClick={() => handleGenerate(job, "resume")}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all disabled:opacity-40">
                              {genResume ? "…" : "📄 CV"}
                            </button>
                          )}
                          {job.description && (
                            <button type="button" title="Generate cover letter PDF" disabled={genResume || genCover} onClick={() => handleGenerate(job, "cover")}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all disabled:opacity-40">
                              {genCover ? "…" : "✉ CL"}
                            </button>
                          )}
                          {job.description && (
                            <button type="button" onClick={() => setExpandedJob(isExpanded ? null : job.url)}
                              className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 dark:hover:text-slate-200 hover:text-slate-600 dark:hover:bg-white/10 hover:bg-slate-100 transition-all"
                              aria-label={isExpanded ? "Hide details" : "Show details"}>
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          )}
                          <a href={job.url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-3 py-1 text-xs text-slate-400 hover:text-slate-100 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all">
                            Apply
                          </a>
                        </div>
                        {isExpanded && ats && <AtsInsightPanel ats={ats} job={job} />}
                        {isExpanded && !ats && job.description && (
                          <div className="mt-3 pt-3 border-t dark:border-white/5 border-slate-200">
                            <div className="text-xs dark:text-slate-400 text-slate-500 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-1">{job.description}</div>
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

      {/* ── Hiring Cafe — easy-apply job list ── */}
      {activeCategory === "hiring-cafe" && (() => {
        const hcJobs = sortJobs(
          filterByLocation(
            filterBySearch(
              filterByTime(jobs.filter((j) => j.category === "hiring-cafe"), timeFilter),
              searchQuery
            ),
            locationFilter
          ),
          sortBy,
          atsScores
        );
        const rawHcJobs = filterByTime(jobs.filter((j) => j.category === "hiring-cafe"), timeFilter);

        return (
          <div>
            {/* Source banner */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
              <span className="text-xl">☕</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-300">
                  Easy-Apply Jobs — <a href="https://hiring.cafe/?searchState=%7B%22searchQuery%22%3A%22software+engineer%22%2C%22sortBy%22%3A%22date%22%2C%22dateFetchedPastNDays%22%3A2%2C%22applicationFormEase%22%3A%5B%22Simple%22%5D%7D" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200 transition-colors">hiring.cafe</a>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Sourced via the scraper — only jobs with a &ldquo;Simple&rdquo; application form. Run <code className="dark:text-slate-300 text-slate-700">npm run scrape</code> to refresh.
                </p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                {rawHcJobs.length} role{rawHcJobs.length !== 1 ? "s" : ""}
              </span>
            </div>

            {rawHcJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600">
                <span className="text-4xl opacity-40">☕</span>
                <p className="text-sm">
                  {error
                    ? "Configure Google Sheets to see live jobs"
                    : `No Hiring Cafe jobs in the ${TIME_FILTERS.find((f) => f.id === timeFilter)?.label.toLowerCase()} — run the scraper or widen the time window`}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border dark:border-white/10 border-slate-200 dark:bg-white/[0.03] bg-white overflow-hidden shadow-sm">
                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b dark:border-white/5 border-slate-100">
                  <div className="relative flex-1 min-w-[160px]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search roles or companies…"
                      className="w-full rounded-lg border dark:border-white/8 border-slate-200 dark:bg-white/5 bg-slate-50 pl-7 pr-3 py-1.5 text-xs dark:text-slate-300 text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="flex gap-1">
                    {(["all", "remote", "onsite"] as LocationFilter[]).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocationFilter(loc)}
                        className={[
                          "rounded-full px-2.5 py-1 text-[10px] font-medium border transition-all",
                          locationFilter === loc
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                            : "dark:bg-white/5 bg-slate-100 text-slate-500 dark:border-white/10 border-slate-200 hover:text-slate-300",
                        ].join(" ")}
                      >
                        {loc === "all" ? "All" : loc === "remote" ? "🏠 Remote" : "🏢 Onsite"}
                      </button>
                    ))}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortMode)}
                    className="rounded-lg border dark:border-white/8 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1.5 text-[10px] dark:text-slate-400 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    <option value="newest">Newest first</option>
                    <option value="ats">Highest ATS</option>
                    <option value="title">Title A–Z</option>
                  </select>
                  {hcJobs.length !== rawHcJobs.length && (
                    <span className="text-[10px] text-slate-500">{hcJobs.length}/{rawHcJobs.length} shown</span>
                  )}
                </div>

                {/* Job list */}
                {hcJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600">
                    <p className="text-sm">No roles match your filters</p>
                    <button type="button" onClick={() => { setSearchQuery(""); setLocationFilter("all"); }} className="text-xs text-indigo-400 hover:text-indigo-300">Clear filters</button>
                  </div>
                ) : (
                  <ul className="divide-y dark:divide-white/5 divide-slate-100 max-h-[640px] overflow-y-auto">
                    {hcJobs.map((job, i) => {
                      const isNew      = job.fetchedAt && Date.now() - new Date(job.fetchedAt).getTime() <= 2 * 3_600_000;
                      const isExpanded = expandedJob === job.url;
                      const ats        = resume && job.description ? calculateAtsScore(job.description, resume) : null;
                      const salary     = extractSalary(job.description ?? "");
                      const resumeKey  = `${job.url}:resume`;
                      const coverKey   = `${job.url}:cover`;
                      const genResume  = !!generating[resumeKey];
                      const genCover   = !!generating[coverKey];
                      return (
                        <li key={i} className={["px-5 py-3 dark:hover:bg-white/[0.03] hover:bg-slate-50 transition-colors", isExpanded ? "dark:bg-white/[0.02] bg-slate-50/80" : ""].join(" ")}>
                          <div className="flex items-start gap-2">
                            {ats && (
                              <div className="shrink-0 mt-0.5" title={`ATS score: ${ats.score}%`}>
                                <AtsRing score={ats.score} size={36} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm dark:text-slate-200 text-slate-800 font-medium truncate">{job.title}</p>
                                {/* Easy Apply badge — always shown for hiring-cafe */}
                                <span className="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-wide">⚡ Easy Apply</span>
                                {isNew && (
                                  <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">NEW</span>
                                )}
                                {ats && ats.score >= 70 && (
                                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/25 uppercase tracking-wide">✓ Strong fit</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {/* Company badge */}
                                {job.company && job.company !== "Hiring Cafe" && (
                                  <span className="text-[10px] font-semibold dark:text-slate-400 text-slate-600 bg-slate-500/10 px-1.5 py-0.5 rounded">{job.company}</span>
                                )}
                                {job.location && (
                                  <p className="text-[11px] text-slate-500 truncate">{job.location}</p>
                                )}
                                {salary && (
                                  <span className="text-[10px] font-medium text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">{salary}</span>
                                )}
                              </div>
                            </div>
                            {job.fetchedAt && (
                              <span className="text-[10px] text-slate-600 shrink-0 hidden sm:block mt-0.5">{timeAgo(job.fetchedAt)}</span>
                            )}
                            {job.description && (
                              <button type="button" title="Generate tailored resume PDF" disabled={genResume || genCover} onClick={() => handleGenerate(job, "resume")}
                                className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all disabled:opacity-40">
                                {genResume ? "…" : "📄 CV"}
                              </button>
                            )}
                            {job.description && (
                              <button type="button" title="Generate cover letter PDF" disabled={genResume || genCover} onClick={() => handleGenerate(job, "cover")}
                                className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all disabled:opacity-40">
                                {genCover ? "…" : "✉ CL"}
                              </button>
                            )}
                            {job.description && (
                              <button type="button" onClick={() => setExpandedJob(isExpanded ? null : job.url)}
                                className="shrink-0 rounded-lg border dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 px-2 py-1 text-[10px] text-slate-400 dark:hover:text-slate-200 hover:text-slate-600 dark:hover:bg-white/10 hover:bg-slate-100 transition-all"
                                aria-label={isExpanded ? "Hide details" : "Show details"}>
                                {isExpanded ? "▲" : "▼"}
                              </button>
                            )}
                            <a href={job.url} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 hover:text-amber-200 hover:bg-amber-500/20 hover:border-amber-400/50 transition-all">
                              Apply
                            </a>
                          </div>
                          {isExpanded && ats && <AtsInsightPanel ats={ats} job={job} />}
                          {isExpanded && !ats && job.description && (
                            <div className="mt-3 pt-3 border-t dark:border-white/5 border-slate-200">
                              <div className="text-xs dark:text-slate-400 text-slate-500 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-1">{job.description}</div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </section>
  );
}
