/**
 * @jest-environment node
 */

// Must mock "fs" BEFORE importing the module under test so Jest intercepts
// the require call.
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockRename = jest.fn().mockResolvedValue(undefined);

jest.mock("fs", () => ({
  promises: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    rename: (...args: unknown[]) => mockRename(...args),
  },
}));

import { getVisitors, appendVisitor, detectBrowser, detectOS } from "@/lib/visitorStore";

const baseEntry = {
  id: "test-id",
  timestamp: "2026-05-26T12:00:00.000Z",
  ip: "1.2.3.4",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
  page: "/",
};

// ---------------------------------------------------------------------------
// getVisitors
// ---------------------------------------------------------------------------

describe("getVisitors", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns [] when file is not found (ENOENT)", async () => {
    mockReadFile.mockRejectedValueOnce(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    );
    expect(await getVisitors()).toEqual([]);
  });

  it("returns [] when file contains invalid JSON", async () => {
    mockReadFile.mockResolvedValueOnce("not-valid-json}}");
    expect(await getVisitors()).toEqual([]);
  });

  it("returns [] when file contains a non-array JSON value", async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ foo: "bar" }));
    expect(await getVisitors()).toEqual([]);
  });

  it("returns the parsed array when the file contains valid data", async () => {
    const data = [{ ...baseEntry, device: "Desktop" }];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(data));
    expect(await getVisitors()).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// appendVisitor
// ---------------------------------------------------------------------------

describe("appendVisitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it("prepends the new entry before existing entries", async () => {
    const existing = [{ ...baseEntry, id: "old", device: "Desktop" }];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(existing));

    await appendVisitor({ ...baseEntry, id: "new" });

    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as typeof existing;
    expect(written[0].id).toBe("new");
    expect(written[1].id).toBe("old");
  });

  it("detects Desktop device from a standard Chrome UA", async () => {
    mockReadFile.mockResolvedValueOnce("[]");
    await appendVisitor({
      ...baseEntry,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
    });
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as Array<{device: string}>;
    expect(written[0].device).toBe("Desktop");
  });

  it("detects Mobile device from an iPhone UA", async () => {
    mockReadFile.mockResolvedValueOnce("[]");
    await appendVisitor({
      ...baseEntry,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) Mobile Safari/604.1",
    });
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as Array<{device: string}>;
    expect(written[0].device).toBe("Mobile");
  });

  it("detects Tablet device from an iPad UA", async () => {
    mockReadFile.mockResolvedValueOnce("[]");
    await appendVisitor({
      ...baseEntry,
      userAgent: "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1",
    });
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as Array<{device: string}>;
    expect(written[0].device).toBe("Tablet");
  });

  it("writes to a .tmp file first (atomic write)", async () => {
    mockReadFile.mockResolvedValueOnce("[]");
    await appendVisitor(baseEntry);
    expect((mockWriteFile.mock.calls[0][0] as string)).toMatch(/\.tmp$/);
  });

  it("calls rename after writeFile (completes atomic swap)", async () => {
    mockReadFile.mockResolvedValueOnce("[]");
    await appendVisitor(baseEntry);
    expect(mockRename).toHaveBeenCalledTimes(1);
  });

  it("caps the list at MAX_ENTRIES (500) entries", async () => {
    const big = Array.from({ length: 500 }, (_, i) => ({
      ...baseEntry,
      id: `entry-${i}`,
      device: "Desktop" as const,
    }));
    mockReadFile.mockResolvedValueOnce(JSON.stringify(big));

    await appendVisitor({ ...baseEntry, id: "overflow" });

    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as typeof big;
    expect(written).toHaveLength(500);
    expect(written[0].id).toBe("overflow");
  });

  it("auto-populates browser field from userAgent", async () => {
    mockReadFile.mockResolvedValueOnce("[]");
    await appendVisitor({
      ...baseEntry,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as Array<{ browser: string }>;
    expect(written[0].browser).toEqual(expect.stringMatching(/^Chrome/));
  });

  it("auto-populates os field from userAgent", async () => {
    mockReadFile.mockResolvedValueOnce("[]");
    await appendVisitor({
      ...baseEntry,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0",
    });
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as Array<{ os: string }>;
    expect(written[0].os).toEqual("macOS");
  });

  it("stores optional extended fields (referrer, country, language, screen, timezone)", async () => {
    mockReadFile.mockResolvedValueOnce("[]");
    await appendVisitor({
      ...baseEntry,
      referrer: "https://github.com/test",
      country: "US",
      city: "New York",
      language: "en-US",
      screen: "1920x1080",
      timezone: "America/New_York",
    });
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as Array<typeof baseEntry & {
      referrer: string; country: string; city: string; language: string; screen: string; timezone: string;
    }>;
    expect(written[0].referrer).toEqual("https://github.com/test");
    expect(written[0].country).toEqual("US");
    expect(written[0].city).toEqual("New York");
    expect(written[0].language).toEqual("en-US");
    expect(written[0].screen).toEqual("1920x1080");
    expect(written[0].timezone).toEqual("America/New_York");
  });
});

// ---------------------------------------------------------------------------
// detectBrowser
// ---------------------------------------------------------------------------

describe("detectBrowser", () => {
  it("detects Chrome", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    expect(detectBrowser(ua)).toEqual(expect.stringMatching(/^Chrome/));
  });

  it("detects Firefox", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0";
    expect(detectBrowser(ua)).toEqual(expect.stringMatching(/^Firefox/));
  });

  it("detects Safari (not Chrome)", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
    expect(detectBrowser(ua)).toEqual(expect.stringMatching(/^Safari/));
  });

  it("detects Edge over Chrome", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36 Edg/120.0";
    expect(detectBrowser(ua)).toEqual(expect.stringMatching(/^Edge/));
  });

  it("returns Other for curl", () => {
    expect(detectBrowser("curl/7.88.1")).toEqual("Other");
  });
});

// ---------------------------------------------------------------------------
// detectOS
// ---------------------------------------------------------------------------

describe("detectOS", () => {
  it("detects Windows 10/11", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0";
    expect(detectOS(ua)).toEqual("Windows 10/11");
  });

  it("detects macOS", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0";
    expect(detectOS(ua)).toEqual("macOS");
  });

  it("detects iOS", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/604.1";
    expect(detectOS(ua)).toEqual("iOS");
  });

  it("detects Android", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0 Mobile";
    expect(detectOS(ua)).toEqual("Android");
  });

  it("detects Linux", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/115.0";
    expect(detectOS(ua)).toEqual("Linux");
  });

  it("detects Windows 8.1 (NT 6.3)", () => {
    const ua = "Mozilla/5.0 (Windows NT 6.3; Win64; x64) Chrome/120.0";
    expect(detectOS(ua)).toEqual("Windows 8.1");
  });

  it("detects Windows 7 (NT 6.1)", () => {
    const ua = "Mozilla/5.0 (Windows NT 6.1; Win64; x64) Chrome/120.0";
    expect(detectOS(ua)).toEqual("Windows 7");
  });

  it("detects generic Windows (NT 6.0)", () => {
    const ua = "Mozilla/5.0 (Windows NT 6.0) Chrome/120.0";
    expect(detectOS(ua)).toEqual("Windows");
  });

  it("detects ChromeOS (CrOS UA)", () => {
    const ua = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0";
    expect(detectOS(ua)).toEqual("ChromeOS");
  });

  it("returns Other for unknown UA string", () => {
    expect(detectOS("UnknownBot/1.0")).toEqual("Other");
  });
});

// ---------------------------------------------------------------------------
// appendVisitor — write failure (read-only filesystem)
// ---------------------------------------------------------------------------

describe("appendVisitor write failure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFile.mockResolvedValue("[]");
  });

  it("logs a warning and does not throw when writeFile rejects", async () => {
    mockWriteFile.mockRejectedValueOnce(new Error("EROFS: read-only file system"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(appendVisitor(baseEntry)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("write skipped"),
      expect.stringContaining("EROFS")
    );
    warnSpy.mockRestore();
  });

  it("logs a warning and does not throw when rename rejects", async () => {
    mockRename.mockRejectedValueOnce(new Error("EXDEV: cross-device link"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(appendVisitor(baseEntry)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("write skipped"),
      expect.stringContaining("EXDEV")
    );
    warnSpy.mockRestore();
  });
});
