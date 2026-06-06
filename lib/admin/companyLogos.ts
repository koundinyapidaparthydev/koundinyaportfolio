/**
 * Resolve a company logo for job rows (known catalog → Clearbit → null).
 */

const KNOWN_LOGOS: Record<string, string> = {
  "live nation": "/Company_Images/LiveNation.jpg",
  airbnb: "/Company_Images/Airbnb.jpg",
  "booking.com": "/Company_Images/BookingCom.jpg",
  booking: "/Company_Images/BookingCom.jpg",
  sabre: "/Company_Images/Sabre.jpg",
  ncl: "/Company_Images/NCL.jpg",
  "royal caribbean group": "/Company_Images/RoyalCaribbean.jpg",
  "royal caribbean": "/Company_Images/RoyalCaribbean.jpg",
  disney: "/Company_Images/Disney.jpg",
  "universal studios": "/Company_Images/UniversalStudios.jpg",
  seaworld: "/Company_Images/SeaWorld.jpg",
  seatgeek: "/Company_Images/SeatGeek.jpg",
  stubhub: "/Company_Images/StubHub.jpg",
  axs: "/Company_Images/AXS.jpg",
  clear: "/Company_Images/CLEAR.jpg",
  flywire: "/Company_Images/Flywire.jpg",
  lyft: "/Company_Images/Lyft.jpg",
  "uber freight": "/Company_Images/UberFreight.jpg",
  uber: "/Company_Images/UberFreight.jpg",
  anthropic: "/Company_Images/Anthropic.ico",
  openai: "/Company_Images/OpenAI.ico",
  cursor: "/Company_Images/Cursor.ico",
  notion: "/Company_Images/Notion.ico",
  zapier: "/Company_Images/Zapier.ico",
  langchain: "/Company_Images/LangChain.ico",
  cohere: "/Company_Images/Cohere.ico",
  "mistral ai": "/Company_Images/MistralAI.ico",
  mistral: "/Company_Images/MistralAI.ico",
  hebbia: "/Company_Images/Hebbia.ico",
  "harvey ai": "/Company_Images/HarveyAI.ico",
  harvey: "/Company_Images/HarveyAI.ico",
  "sierra ai": "/Company_Images/SierraAI.ico",
  sierra: "/Company_Images/SierraAI.ico",
  ema: "/Company_Images/Ema.ico",
  "adept ai": "/Company_Images/AdeptAI.ico",
  adept: "/Company_Images/AdeptAI.ico",
  "cognition ai": "/Company_Images/CognitionAI.ico",
  cognition: "/Company_Images/CognitionAI.ico",
  "dust.tt": "/Company_Images/Dusttt.ico",
  dust: "/Company_Images/Dusttt.ico",
  linear: "/Company_Images/Linear.ico",
  retool: "/Company_Images/Retool.ico",
  writer: "/Company_Images/Writer.ico",
  "runway ml": "/Company_Images/RunwayML.ico",
  runway: "/Company_Images/RunwayML.ico",
  "pathos ai": "/Company_Images/Anthropic.ico",
  slack: "/Company_Images/Slack.ico",
  workato: "/Company_Images/Workato.ico",
  make: "/Company_Images/Make.ico",
  celonis: "/Company_Images/Make.ico",
  glean: "/Company_Images/Glean.ico",
  moveworks: "/Company_Images/Moveworks.ico",
  "weights & biases": "/Company_Images/WeightsAndBiases.svg",
  "weights and biases": "/Company_Images/WeightsAndBiases.svg",
  wandb: "/Company_Images/WeightsAndBiases.svg",
  codeium: "/Company_Images/Codeium.ico",
  windsurf: "/Company_Images/Codeium.ico",
  salesforce: "/Company_Images/Salesforce.ico",
  microsoft: "/Company_Images/Microsoft.ico",
  servicenow: "/Company_Images/ServiceNow.ico",
  amazon: "/Company_Images/Amazon.ico",
  google: "/Company_Images/Google.ico",
  meta: "/Company_Images/Meta.ico",
  apple: "/Company_Images/Apple.ico",
  "snap inc.": "/Company_Images/Snapchat.png",
  snap: "/Company_Images/Snapchat.png",
  stripe: "/Company_Images/Stripe.ico",
  databricks: "/Company_Images/Databricks.ico",
  twilio: "/Company_Images/Twilio.ico",
  cloudflare: "/Company_Images/Cloudflare.ico",
  datadog: "/Company_Images/Datadog.ico",
  mongodb: "/Company_Images/MongoDB.ico",
  "riot games": "/Company_Images/RiotGames.ico",
  vercel: "/Company_Images/Vercel.ico",
  instacart: "/Company_Images/Instacart.ico",
  pinterest: "/Company_Images/Pinterest.ico",
  doordash: "/Company_Images/DoorDash.ico",
  figma: "/Company_Images/Figma.ico",
  brex: "/Company_Images/Brex.ico",
  ramp: "/Company_Images/Ramp.ico",
  confluent: "/Company_Images/Confluent.ico",
  snowflake: "/Company_Images/Snowflake.ico",
  adobe: "/Company_Images/Adobe.ico",
  intuit: "/Company_Images/Intuit.png",
  qualcomm: "/Company_Images/Qualcomm.ico",
  paypal: "/Company_Images/PayPal.ico",
  "capital one": "/Company_Images/CapitalOne.ico",
  "jpmorgan chase": "/Company_Images/JPMorganChase.ico",
  jpmorgan: "/Company_Images/JPMorganChase.ico",
  shopify: "/Company_Images/Shopify.ico",
  zendesk: "/Company_Images/Zendesk.ico",
};

function normalizeCompanyName(name: string): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^\w\s.&/-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupKnownLogo(company: string): string | null {
  const key = normalizeCompanyName(company);
  if (!key) return null;
  if (KNOWN_LOGOS[key]) return KNOWN_LOGOS[key];

  for (const [known, logo] of Object.entries(KNOWN_LOGOS)) {
    if (key.includes(known) || known.includes(key)) return logo;
  }
  return null;
}

/** Guess a company domain from ATS job URLs for Clearbit logo lookup. */
function guessDomainFromJobUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("greenhouse.io") && segments[0]) {
      const slug = segments[0].replace(/inc$|llc$|corp$/, "");
      return `${slug}.com`;
    }
    if (host.includes("ashbyhq.com") && segments[0]) {
      return `${segments[0]}.com`;
    }
    if (host.includes("lever.co") && segments[0]) {
      return `${segments[0]}.com`;
    }
    if (
      !host.includes("workday") &&
      !host.includes("greenhouse") &&
      !host.includes("ashby") &&
      !host.includes("lever.co") &&
      !host.includes("icims") &&
      !host.includes("smartrecruiters")
    ) {
      return host.replace(/^www\./, "");
    }
  } catch {
    /* invalid URL */
  }
  return null;
}

/** Local asset path, Clearbit URL, or null (caller shows initials). */
export function resolveCompanyLogo(company: string, jobUrl = ""): string | null {
  const known = lookupKnownLogo(company);
  if (known) return known;

  const domain = guessDomainFromJobUrl(jobUrl);
  if (domain) return `https://logo.clearbit.com/${domain}`;

  return null;
}

export function companyInitial(company: string): string {
  const trimmed = (company ?? "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
