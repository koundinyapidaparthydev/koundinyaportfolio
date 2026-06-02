# Resume PDF Generation

## Overview

Visitors can download the resume as a PDF directly from the portfolio. The PDF is generated server-side on demand using `@react-pdf/renderer`.

---

## How It Works

```
User clicks "Download PDF"
        │
        ▼
Client sends POST /api/resume/pdf
  Body: { resume: Resume }
        │
        ▼
Server renders lib/resumePdf.tsx → PDF buffer
        │
        ▼
Response: Content-Type: application/pdf
  Content-Disposition: attachment; filename="resume.pdf"
        │
        ▼
Browser downloads the file
```

---

## `lib/resumePdf.tsx`

This file defines a full React tree using `@react-pdf/renderer` primitives:

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
```

The PDF layout mirrors the visual structure of the portfolio:
- **Header**: Name, title, contact info
- **Summary**: Personal summary paragraph
- **Experience**: Company, role, date, bullet points
- **Education**: Institution, degree, GPA
- **Skills**: Grouped by category
- **Projects**: Name, stack, bullet points

---

## Styling

`@react-pdf/renderer` uses a subset of CSS-like styles. Only **flexbox**, basic box model properties, and text styles are supported. No CSS Grid, pseudo-classes, or media queries.

```ts
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  section: { marginBottom: 12 },
  heading: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  bullet: { fontSize: 10, lineHeight: 1.5, color: '#334155' },
});
```

---

## `/api/resume/pdf` Route

**File**: `app/api/resume/pdf/route.ts`

```ts
// POST handler
const resume = await req.json();
const pdfBuffer = await renderToBuffer(<ResumeDocument resume={resume} />);

return new Response(pdfBuffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="koundinya-pidaparthy-resume.pdf"',
  },
});
```

---

## AI-Tailored PDF

The admin can:
1. Tailor the resume with AI (via `/api/resume/tailor`)
2. Review the AI-modified resume in the editor
3. Download a PDF of the AI-tailored version

This works because the PDF endpoint accepts the **current resume state** as the POST body — not a fixed file.

---

## Fonts

`@react-pdf/renderer` bundles the **Helvetica** font family by default. Custom fonts can be registered with:

```ts
import { Font } from '@react-pdf/renderer';
Font.register({ family: 'Inter', src: '/fonts/Inter-Regular.ttf' });
```

Currently the PDF uses the default Helvetica for maximum compatibility and no additional loading time.

---

## Known Limitations

- No CSS Grid or flexbox `gap` property (use margins instead)
- No `position: absolute` in complex layouts
- SVG support is limited
- Emoji characters may not render in all PDF viewers
- File size is typically 80–150 KB for a single-page resume
