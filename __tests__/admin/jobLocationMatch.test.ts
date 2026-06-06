import {
  filterByCountryLocation,
  isIndiaLocation,
  isUnitedStatesLocation,
  matchesLocation,
} from "@/lib/admin/jobLocationMatch";

describe("matchesLocation", () => {
  it('returns true for every location when filter is "all"', () => {
    expect(matchesLocation("", "all")).toBe(true);
    expect(matchesLocation("Remote", "all")).toBe(true);
    expect(matchesLocation("London, UK", "all")).toBe(true);
  });

  it("excludes empty locations for us/in filters", () => {
    expect(matchesLocation("", "us")).toBe(false);
    expect(matchesLocation("   ", "in")).toBe(false);
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
});

describe("filterByCountryLocation", () => {
  const jobs = [
    { location: "San Francisco, CA", title: "US role" },
    { location: "Bangalore, India", title: "IN role" },
    { location: "London, UK", title: "UK role" },
    { location: "", title: "Empty" },
  ];

  it("returns all jobs when filter is all", () => {
    expect(filterByCountryLocation(jobs, "all")).toHaveLength(4);
  });

  it("filters to US jobs only", () => {
    const result = filterByCountryLocation(jobs, "us");
    expect(result.map((j) => j.title)).toEqual(["US role"]);
  });

  it("filters to India jobs only", () => {
    const result = filterByCountryLocation(jobs, "in");
    expect(result.map((j) => j.title)).toEqual(["IN role"]);
  });
});
