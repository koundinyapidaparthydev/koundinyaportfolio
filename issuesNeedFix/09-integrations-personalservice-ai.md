# Issue 09: PersonalService + Ai Folder Integration

## Goal

Use existing tooling under `/Users/koundinya.pidaparthy/Desktop/P1kp/` to improve job pipeline, email awareness, and form filling — **without** copying tokens into the portfolio git repo.

## PersonalService

**Path:** `/Users/koundinya.pidaparthy/Desktop/P1kp/PersonalService/`

| Resource | Use in portfolio |
|----------|------------------|
| `config/user.json` | Profile 3 = primary job-search email (`koundinyapidaparthy@gmail.com`) |
| `services/gmail.js` | Read interview/offer emails — future: webhook or cron to update sheet Notes column |
| `../Email/token.profile3.json` | Gmail OAuth for Profile 3 (local only) |
| WhatsApp config | Same tokens as `WHATSAPP_*` in GitHub secrets |

**Implemented in portfolio:**

- `scripts/lib/applicant-profile.mjs` — if `PERSONAL_SERVICE_CONFIG` env points to `user.json`, auto-apply uses Profile 3 email/name defaults.

**Suggested next steps:**

1. Cron script: scan Profile 3 inbox for “interview” / “offer” → append to sheet column M.
2. Reuse PersonalService categorization rules from `gmail.js` for weekly summary context.

## Ai / AplifyAI

**Path:** `/Users/koundinya.pidaparthy/Desktop/P1kp/Ai/aplifyai-web/`

| Resource | Use in portfolio |
|----------|------------------|
| `apps/extension/src/smart-apply/` | FormDetector + FormFiller patterns (ported to Playwright `fillIfExists` fallback) |
| `docs/browser_extension.md` | Architecture reference for ATS autofill |
| `resume-generator/server.js` | Alternative PDF pipeline (LaTeX); optional HTTP fallback if React-PDF fails |

**Not merged yet:**

- Chrome extension does not call portfolio APIs by default.
- Optional future: extension posts job URL to `/api/jobs` and reads tailored resume URL from sheet.

## Environment variable (local)

```bash
# .env.local (optional)
PERSONAL_SERVICE_CONFIG=/Users/koundinya.pidaparthy/Desktop/P1kp/PersonalService/config/user.json
APPLICANT_PROFILE_ID=profile3
```

## Security

- Do **not** commit `user.json` tokens, Gmail tokens, or `.env.local`.
- Rotate WhatsApp/Meta tokens if they appeared in chat or logs.

## Checklist

- [ ] `PERSONAL_SERVICE_CONFIG` set locally for auto-apply tests
- [ ] Profile 3 Gmail token valid under `Email/token.profile3.json`
- [ ] Document extension ↔ portfolio API contract (future)
