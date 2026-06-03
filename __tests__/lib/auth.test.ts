import { normalizeEnvValue } from "@/lib/env";

describe("normalizeEnvValue", () => {
  it("returns trimmed value without quotes", () => {
    expect(normalizeEnvValue("  secret  ")).toBe("secret");
  });

  it("strips single-quoted values", () => {
    expect(normalizeEnvValue("'K!@#$oundinya'")).toBe("K!@#$oundinya");
  });

  it("strips double-quoted values", () => {
    expect(normalizeEnvValue('"admin@example.com"')).toBe("admin@example.com");
  });
});
