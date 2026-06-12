/**
 * @jest-environment node
 */

const mockValuesGet = jest.fn();

jest.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({})),
    },
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          get: mockValuesGet,
        },
      },
    })),
  },
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/jobs/route";

const sheetRows = [
  [
    "Company",
    "Title",
    "Location",
    "URL",
    "Category",
    "Fetched At",
    "Description",
    "",
    "",
    "",
    "",
    "",
    "",
    "Posted At",
  ],
  [
    "HC Co",
    "Engineer",
    "Remote",
    "https://hiring.cafe/job/abc12345",
    "hiring-cafe",
    "2026-06-12T10:00:00.000Z",
    "desc",
    "",
    "",
    "",
    "",
    "",
    "",
    "2026-06-12T09:00:00.000Z",
  ],
  [
    "Legacy Co",
    "Engineer",
    "NYC",
    "https://boards.greenhouse.io/acme/jobs/1",
    "fintech",
    "2026-06-12T10:00:00.000Z",
    "desc",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
];

describe("GET /api/jobs", () => {
  const origSheetId = process.env.GOOGLE_SHEET_ID;
  const origSa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_SHEET_ID = "sheet-id";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "x", private_key: "y" });
    mockValuesGet.mockResolvedValue({ data: { values: sheetRows } });
  });

  afterAll(() => {
    process.env.GOOGLE_SHEET_ID = origSheetId;
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = origSa;
  });

  it("returns hiring-cafe rows only by default", async () => {
    const res = await GET(new NextRequest("http://localhost/api/jobs"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobs: { company: string }[] };
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].company).toBe("HC Co");
  });

  it("includes legacy rows when includeLegacy=true", async () => {
    const res = await GET(new NextRequest("http://localhost/api/jobs?includeLegacy=true"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobs: unknown[] };
    expect(body.jobs).toHaveLength(2);
  });
});
