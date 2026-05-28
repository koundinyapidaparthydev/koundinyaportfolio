/**
 * Email notification helper — sends a visitor alert to the portfolio owner.
 *
 * Used exclusively from the server-side /api/track route.
 * Requires the following environment variables:
 *   EMAIL_FROM      — Gmail address to send from (defaults to the owner address)
 *   EMAIL_PASSWORD  — Gmail App Password (not the account password)
 */

import nodemailer from "nodemailer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VisitorInfo {
  /** Raw IP address extracted from request headers. */
  ip: string;
  /** Full User-Agent string from the request. */
  userAgent: string;
  /** ISO-8601 timestamp of when the visit was recorded server-side. */
  timestamp: string;
}

interface GeoData {
  status: "success" | "fail";
  city?: string;
  regionName?: string;
  country?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Classify the User-Agent string into Desktop / Tablet / Mobile. */
function getDeviceType(userAgent: string): string {
  if (/tablet|ipad/i.test(userAgent)) return "Tablet";
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent))
    return "Mobile";
  return "Desktop";
}

/**
 * Look up the approximate city/region/country for a public IP address.
 * Uses the free ip-api.com service (no API key required, 45 req/min limit).
 * Returns a human-readable string on success, or a safe fallback on any error.
 */
async function getApproximateLocation(ip: string): Promise<string> {
  // Private / loopback / link-local ranges — no meaningful geo data available
  const privateRanges = [
    /^::1$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^::ffff:127\./,
  ];
  if (!ip || privateRanges.some((re) => re.test(ip))) {
    return "Local / Private Network";
  }

  try {
    const cleanIp = encodeURIComponent(ip);
    const res = await fetch(
      `http://ip-api.com/json/${cleanIp}?fields=status,city,regionName,country`,
      { signal: AbortSignal.timeout(4_000) }
    );
    if (!res.ok) return "Unknown";
    const geo: GeoData = (await res.json()) as GeoData;
    if (geo.status === "success") {
      return [geo.city, geo.regionName, geo.country].filter(Boolean).join(", ");
    }
  } catch {
    // Network error or timeout — fall through to the default
  }
  return "Unknown";
}

/** Format an ISO timestamp into a readable Eastern Time string. */
function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/New_York",
    });
  } catch {
    return iso;
  }
}

// ─── Email Sender ─────────────────────────────────────────────────────────────

/**
 * Send a visitor notification email to the portfolio owner.
 * Does NOT throw — all errors are swallowed so a mail failure never
 * affects the visitor's experience.
 */
export async function sendVisitorNotification(
  info: VisitorInfo
): Promise<void> {
  const emailFrom =
    process.env.EMAIL_FROM ?? "koundinyapidaparthy@gmail.com";
  const emailPassword = process.env.EMAIL_PASSWORD;

  // If credentials are not configured, skip silently (e.g., local dev)
  if (!emailPassword) {
    console.warn(
      "[emailNotification] EMAIL_PASSWORD not set — skipping visitor email."
    );
    return;
  }

  const [location] = await Promise.all([getApproximateLocation(info.ip)]);
  const deviceType = getDeviceType(info.userAgent);
  const readableTime = formatTimestamp(info.timestamp);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailFrom,
      pass: emailPassword,
    },
  });

  const subject = `👀 New portfolio visitor — ${readableTime}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#4338ca 100%);padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
                New Portfolio Visit 🎉
              </h1>
              <p style="margin:4px 0 0;color:#a5b4fc;font-size:14px;">
                Someone just landed on koundinyapidaparthy.com
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;width:100px;vertical-align:top;">
                    Timestamp
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;font-weight:500;">
                    ${readableTime} ET
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;vertical-align:top;">
                    Location
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;font-weight:500;">
                    ${location}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;vertical-align:top;">
                    Device
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;font-weight:500;">
                    ${deviceType}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#64748b;font-size:13px;vertical-align:top;">
                    IP Address
                  </td>
                  <td style="padding:10px 0;color:#94a3b8;font-size:13px;font-family:monospace;">
                    ${info.ip}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                Sent automatically by your portfolio tracking service. Raw UA: <br />
                <span style="font-family:monospace;word-break:break-all;">${info.userAgent.substring(0, 200)}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    await transporter.sendMail({
      from: `"Portfolio Tracker" <${emailFrom}>`,
      to: "koundinyapidaparthy@gmail.com",
      subject,
      html,
    });
  } catch {
    // sendMail failures are silently swallowed — a mail error must never
    // affect the visitor's experience (matches the JSDoc contract).
  }
}
