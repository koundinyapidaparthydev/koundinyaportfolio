/** Default API response: Hiring Cafe rows only. */
export function isHiringCafeJob(job: { category: string; url: string }): boolean {
  if (job.category === "hiring-cafe") return true;
  return job.url.toLowerCase().includes("hiring.cafe");
}
