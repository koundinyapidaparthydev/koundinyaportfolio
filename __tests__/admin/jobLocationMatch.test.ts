import {
  filterByCountryLocation,
  isDubaiLocation,
  isIndiaLocation,
  isSingaporeLocation,
  isSupportedLocation,
  isUnitedStatesLocation,
  matchesLocation,
} from "@/lib/admin/jobLocationMatch";

describe("matchesLocation", () => {
  it('excludes empty and unsupported locations when filter is "all"', () => {
    expect(matchesLocation("", "all")).toBe(false);
    expect(matchesLocation("Remote", "all")).toBe(false);
    expect(matchesLocation("London, UK", "all")).toBe(false);
    expect(matchesLocation("San Francisco, CA", "all")).toBe(true);
  });

  it("excludes empty locations for region filters", () => {
    expect(matchesLocation("", "us")).toBe(false);
    expect(matchesLocation("   ", "in")).toBe(false);
    expect(matchesLocation("", "dubai")).toBe(false);
    expect(matchesLocation("", "sg")).toBe(false);
  });

  describe("United States", () => {
    const usSamples = [
      "United States",
      "Remote - United States",
      "Remote, US",
      "San Francisco, CA",
      "New York, NY",
      "Austin, TX",
      "USA",
      "US-only",
      "Remote United States",
      "North America — US",
      "(US)",
    ];

    it.each(usSamples)('matches US: "%s"', (location) => {
      expect(matchesLocation(location, "us")).toBe(true);
      expect(isUnitedStatesLocation(location)).toBe(true);
    });

    it("does not match non-US locations", () => {
      expect(matchesLocation("London, UK", "us")).toBe(false);
      expect(matchesLocation("Toronto, Canada", "us")).toBe(false);
      expect(matchesLocation("Remote", "us")).toBe(false);
      expect(matchesLocation("Bangalore, India", "us")).toBe(false);
    });

    it("avoids false positives from substrings", () => {
      expect(matchesLocation("Campus recruiting", "us")).toBe(false);
      expect(matchesLocation("Status update", "us")).toBe(false);
    });
  });

  describe("India", () => {
    const indiaSamples = [
      "India",
      "Bangalore, India",
      "Bengaluru",
      "Hyderabad",
      "Mumbai",
      "Delhi",
      "Noida",
      "Gurgaon",
      "Gurugram",
      "Pune",
      "Chennai",
      "Remote - India",
      "Remote India",
    ];

    it.each(indiaSamples)('matches India: "%s"', (location) => {
      expect(matchesLocation(location, "in")).toBe(true);
      expect(isIndiaLocation(location)).toBe(true);
    });

    it("does not match non-India locations", () => {
      expect(matchesLocation("United States", "in")).toBe(false);
      expect(matchesLocation("London, UK", "in")).toBe(false);
      expect(matchesLocation("Remote", "in")).toBe(false);
    });
  });

  describe("Dubai", () => {
    const dubaiSamples = [
      "Dubai",
      "Dubai, UAE",
      "United Arab Emirates",
      "Remote - Dubai",
      "Remote UAE",
    ];

    it.each(dubaiSamples)('matches Dubai: "%s"', (location) => {
      expect(matchesLocation(location, "dubai")).toBe(true);
      expect(isDubaiLocation(location)).toBe(true);
    });

    it("does not match non-Dubai locations", () => {
      expect(matchesLocation("Singapore", "dubai")).toBe(false);
      expect(matchesLocation("San Francisco, CA", "dubai")).toBe(false);
    });
  });

  describe("Singapore", () => {
    const sgSamples = [
      "Singapore",
      "Remote - Singapore",
      "Singapore, SG",
      "(SG)",
    ];

    it.each(sgSamples)('matches Singapore: "%s"', (location) => {
      expect(matchesLocation(location, "sg")).toBe(true);
      expect(isSingaporeLocation(location)).toBe(true);
    });

    it("does not match non-Singapore locations", () => {
      expect(matchesLocation("Dubai", "sg")).toBe(false);
      expect(matchesLocation("Bangalore, India", "sg")).toBe(false);
    });
  });
});

describe("isSupportedLocation", () => {
  it("matches any of the four supported regions", () => {
    expect(isSupportedLocation("San Francisco, CA")).toBe(true);
    expect(isSupportedLocation("Bangalore, India")).toBe(true);
    expect(isSupportedLocation("Dubai, UAE")).toBe(true);
    expect(isSupportedLocation("Singapore")).toBe(true);
    expect(isSupportedLocation("London, UK")).toBe(false);
    expect(isSupportedLocation("")).toBe(false);
  });
});

describe("filterByCountryLocation", () => {
  const jobs = [
    { location: "San Francisco, CA", title: "US role" },
    { location: "Bangalore, India", title: "IN role" },
    { location: "Dubai, UAE", title: "Dubai role" },
    { location: "Singapore", title: "SG role" },
    { location: "London, UK", title: "UK role" },
    { location: "", title: "Empty" },
  ];

  it("returns only supported-region jobs when filter is all", () => {
    expect(filterByCountryLocation(jobs, "all").map((j) => j.title)).toEqual([
      "US role",
      "IN role",
      "Dubai role",
      "SG role",
    ]);
  });

  it("filters to US jobs only", () => {
    const result = filterByCountryLocation(jobs, "us");
    expect(result.map((j) => j.title)).toEqual(["US role"]);
  });

  it("filters to India jobs only", () => {
    const result = filterByCountryLocation(jobs, "in");
    expect(result.map((j) => j.title)).toEqual(["IN role"]);
  });

  it("filters to Dubai jobs only", () => {
    const result = filterByCountryLocation(jobs, "dubai");
    expect(result.map((j) => j.title)).toEqual(["Dubai role"]);
  });

  it("filters to Singapore jobs only", () => {
    const result = filterByCountryLocation(jobs, "sg");
    expect(result.map((j) => j.title)).toEqual(["SG role"]);
  });
});
