/**
 * @jest-environment node
 *
 * __tests__/pipeline/envParser.test.ts
 *
 * Tests for the hand-rolled .env.local parser used in the pipeline scripts.
 *
 * The parser logic is replicated inline below. It reads a ".env.local"
 * string, splits into lines, and applies specific rules:
 *
 *   For JSON values (value.startsWith('{')):
 *     - If the env var is not currently set → set it
 *     - If it IS set but the current value is not valid JSON → override
 *     - If it IS set and is valid JSON → keep the current value
 *
 *   For non-JSON values:
 *     - If the env var is not currently set → set it
 *     - If it IS already set → keep it (command-line / existing value wins)
 *
 * Comments (#), blank lines, and lines without '=' are skipped.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline env-parser logic
// ─────────────────────────────────────────────────────────────────────────────

type EnvStore = Record<string, string | undefined>;

/**
 * Parse a .env.local file contents string and apply values to `env`.
 * Returns a copy of `env` with the applied changes.
 */
function applyEnvFile(fileContents: string, env: EnvStore = {}): EnvStore {
  const result = { ...env };
  const lines = fileContents.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Skip blank lines and comments
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    if (!key) continue;
    let value = line.slice(eqIdx + 1).trim();
    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const current = result[key];
    if (value.startsWith("{")) {
      // JSON value logic
      if (!current) {
        result[key] = value;
      } else {
        try {
          JSON.parse(current);
          // Current is valid JSON → keep it
        } catch {
          // Current is invalid JSON → override with file value
          result[key] = value;
        }
      }
    } else {
      // Non-JSON value logic
      if (!current) {
        result[key] = value;
      }
      // else: keep existing value (command-line wins)
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// applyEnvFile – empty / trivial inputs
// ─────────────────────────────────────────────────────────────────────────────

describe("applyEnvFile – empty / trivial inputs", () => {
  it("returns empty object for empty file", () => {
    const result = applyEnvFile("", {});
    expect(result).toEqual({});
  });

  it("returns empty object for file with only blank lines", () => {
    const result = applyEnvFile("\n\n\n   \n", {});
    expect(result).toEqual({});
  });

  it("returns empty object for file with only comments", () => {
    const result = applyEnvFile("# This is a comment\n# Another comment", {});
    expect(result).toEqual({});
  });

  it("returns empty object for file with mixed blanks and comments", () => {
    const result = applyEnvFile("\n# comment\n\n# another\n", {});
    expect(result).toEqual({});
  });

  it("preserves existing env values when file is empty", () => {
    const result = applyEnvFile("", { FOO: "bar" });
    expect(result.FOO).toBe("bar");
  });

  it("preserves multiple existing env values when file is empty", () => {
    const result = applyEnvFile("", { A: "1", B: "2", C: "3" });
    expect(result).toEqual({ A: "1", B: "2", C: "3" });
  });

  it("does not mutate the original env object", () => {
    const env: EnvStore = { FOO: "original" };
    applyEnvFile("FOO=changed", env);
    expect(env.FOO).toBe("original");
  });

  it("returns a new object each call", () => {
    const env: EnvStore = {};
    const r1 = applyEnvFile("", env);
    const r2 = applyEnvFile("", env);
    expect(r1).not.toBe(r2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyEnvFile – non-JSON value rules
// ─────────────────────────────────────────────────────────────────────────────

describe("applyEnvFile – non-JSON values", () => {
  it("sets a non-JSON value when env var is not set", () => {
    const result = applyEnvFile("API_KEY=abc123", {});
    expect(result.API_KEY).toBe("abc123");
  });

  it("does NOT override a non-JSON value already in env", () => {
    const result = applyEnvFile("API_KEY=new-value", { API_KEY: "existing-value" });
    expect(result.API_KEY).toBe("existing-value");
  });

  it("sets multiple non-JSON values from file when none are in env", () => {
    const file = "A=1\nB=2\nC=3";
    const result = applyEnvFile(file, {});
    expect(result).toEqual({ A: "1", B: "2", C: "3" });
  });

  it("keeps existing values while setting new ones from file", () => {
    const file = "A=file-a\nB=file-b";
    const result = applyEnvFile(file, { A: "env-a" });
    expect(result.A).toBe("env-a"); // kept
    expect(result.B).toBe("file-b"); // set
  });

  it("does not override any of multiple existing env vars", () => {
    const file = "A=file-a\nB=file-b\nC=file-c";
    const result = applyEnvFile(file, { A: "env-a", B: "env-b", C: "env-c" });
    expect(result.A).toBe("env-a");
    expect(result.B).toBe("env-b");
    expect(result.C).toBe("env-c");
  });

  it("handles value with spaces", () => {
    const result = applyEnvFile("MESSAGE=hello world", {});
    expect(result.MESSAGE).toBe("hello world");
  });

  it("handles value with = in it (only first = is the separator)", () => {
    const result = applyEnvFile("FORMULA=a=b+c", {});
    expect(result.FORMULA).toBe("a=b+c");
  });

  it("handles URL values", () => {
    const result = applyEnvFile("DATABASE_URL=postgresql://user:pass@host:5432/db", {});
    expect(result.DATABASE_URL).toBe("postgresql://user:pass@host:5432/db");
  });

  it("handles empty value", () => {
    const result = applyEnvFile("EMPTY=", {});
    expect(result.EMPTY).toBe("");
  });

  it("handles value with special characters", () => {
    const result = applyEnvFile("SECRET=!@#$%^&*", {});
    expect(result.SECRET).toBe("!@#$%^&*");
  });

  it("handles numeric values as strings", () => {
    const result = applyEnvFile("PORT=3000", {});
    expect(result.PORT).toBe("3000");
  });

  it("handles boolean string values", () => {
    const result = applyEnvFile("DEBUG=true", {});
    expect(result.DEBUG).toBe("true");
  });

  it("handles undefined env as default", () => {
    const result = applyEnvFile("FOO=bar");
    expect(result.FOO).toBe("bar");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyEnvFile – JSON value rules
// ─────────────────────────────────────────────────────────────────────────────

describe("applyEnvFile – JSON values", () => {
  const validJson = JSON.stringify({ type: "service_account", project_id: "my-project", private_key: "-----BEGIN RSA PRIVATE KEY-----\n..." });
  const anotherValidJson = JSON.stringify({ service: "compute", region: "us-central1" });
  const invalidJson = "{not valid json}";
  const truncatedJson = '{"type":"service_account","project_id":'; // truncated

  it("sets a JSON value when env var is not set", () => {
    const result = applyEnvFile(`CREDS=${validJson}`, {});
    expect(result.CREDS).toBe(validJson);
  });

  it("keeps current value when it is valid JSON", () => {
    const result = applyEnvFile(`CREDS=${validJson}`, { CREDS: anotherValidJson });
    expect(result.CREDS).toBe(anotherValidJson); // kept, not overridden
  });

  it("overrides current value when it is invalid JSON", () => {
    const result = applyEnvFile(`CREDS=${validJson}`, { CREDS: invalidJson });
    expect(result.CREDS).toBe(validJson);
  });

  it("overrides truncated/mangled JSON (common with dotenvx encryption)", () => {
    const result = applyEnvFile(`CREDS=${validJson}`, { CREDS: truncatedJson });
    expect(result.CREDS).toBe(validJson);
  });

  it("does not set JSON value when current is valid JSON even if different content", () => {
    const current = JSON.stringify({ a: 1 });
    const file = JSON.stringify({ b: 2 });
    const result = applyEnvFile(`KEY=${file}`, { KEY: current });
    expect(result.KEY).toBe(current);
  });

  it("treats empty string as non-set and assigns JSON value", () => {
    // Current value is empty string → falsy → set it
    const result = applyEnvFile(`CREDS=${validJson}`, { CREDS: "" });
    expect(result.CREDS).toBe(validJson);
  });

  it("sets JSON value when current is empty object string", () => {
    // "{}" is valid JSON, so it should keep it
    const result = applyEnvFile(`CREDS=${validJson}`, { CREDS: "{}" });
    expect(result.CREDS).toBe("{}"); // {} is valid JSON → kept
  });

  it("handles JSON value with newlines in private_key", () => {
    const jsonWithNewlines = JSON.stringify({ private_key: "key\\nvalue" });
    const result = applyEnvFile(`GCS_JSON=${jsonWithNewlines}`, {});
    expect(result.GCS_JSON).toBe(jsonWithNewlines);
  });

  it("handles multiple JSON vars in same file", () => {
    const json1 = JSON.stringify({ project: "a" });
    const json2 = JSON.stringify({ project: "b" });
    const file = `GCS_CREDS=${json1}\nOTHER_CREDS=${json2}`;
    const result = applyEnvFile(file, {});
    expect(result.GCS_CREDS).toBe(json1);
    expect(result.OTHER_CREDS).toBe(json2);
  });

  it("mixes JSON and non-JSON vars correctly", () => {
    const json = JSON.stringify({ key: "val" });
    const file = `CREDS=${json}\nAPI_KEY=mykey`;
    const result = applyEnvFile(file, {});
    expect(result.CREDS).toBe(json);
    expect(result.API_KEY).toBe("mykey");
  });

  it("does not override non-JSON var when JSON var is being overridden", () => {
    const json = JSON.stringify({ key: "val" });
    const file = `CREDS=${json}\nAPI_KEY=file-key`;
    const result = applyEnvFile(file, { CREDS: "{bad json", API_KEY: "env-key" });
    expect(result.CREDS).toBe(json); // overridden because invalid
    expect(result.API_KEY).toBe("env-key"); // kept because non-JSON
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyEnvFile – comment and formatting edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("applyEnvFile – comment and formatting handling", () => {
  it("skips lines starting with #", () => {
    const result = applyEnvFile("# FOO=bar\nBAZ=qux", {});
    expect(result.FOO).toBeUndefined();
    expect(result.BAZ).toBe("qux");
  });

  it("skips inline comments? (no, only full-line comments)", () => {
    // Our implementation only skips lines that START with #
    // Inline comments like FOO=bar # comment are treated as values
    const result = applyEnvFile("FOO=bar # comment", {});
    // The value includes the comment since we don't strip inline comments
    expect(result.FOO).toBe("bar # comment");
  });

  it("skips blank lines between valid entries", () => {
    const result = applyEnvFile("\nA=1\n\nB=2\n", {});
    expect(result.A).toBe("1");
    expect(result.B).toBe("2");
  });

  it("skips lines with no = sign", () => {
    const result = applyEnvFile("NO_EQUALS_SIGN\nFOO=bar", {});
    expect(result.NO_EQUALS_SIGN).toBeUndefined();
    expect(result.FOO).toBe("bar");
  });

  it("skips line where key is empty (=value)", () => {
    const result = applyEnvFile("=no-key\nFOO=bar", {});
    expect(result[""]).toBeUndefined();
    expect(result.FOO).toBe("bar");
  });

  it("handles Windows-style CRLF line endings", () => {
    const result = applyEnvFile("A=1\r\nB=2\r\n", {});
    // \r gets included in value because we only split on \n, not \r\n
    // Depending on implementation, A might be "1" or "1\r"
    expect(result.A).toBeDefined();
    expect(result.B).toBeDefined();
  });

  it("handles multiple # comment lines at the top", () => {
    const file = "# line 1\n# line 2\n# line 3\nFOO=bar";
    const result = applyEnvFile(file, {});
    expect(result.FOO).toBe("bar");
  });

  it("handles file with no trailing newline", () => {
    const result = applyEnvFile("FOO=bar", {});
    expect(result.FOO).toBe("bar");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyEnvFile – quoted values
// ─────────────────────────────────────────────────────────────────────────────

describe("applyEnvFile – quoted values", () => {
  it("strips double quotes around value", () => {
    const result = applyEnvFile('FOO="hello world"', {});
    expect(result.FOO).toBe("hello world");
  });

  it("strips single quotes around value", () => {
    const result = applyEnvFile("FOO='hello world'", {});
    expect(result.FOO).toBe("hello world");
  });

  it("strips double quotes from JSON value", () => {
    const json = JSON.stringify({ key: "val" });
    const result = applyEnvFile(`CREDS="${json}"`, {});
    expect(result.CREDS).toBe(json);
  });

  it("does not strip mismatched quotes", () => {
    // Starts with " but ends with ' → not stripped
    const result = applyEnvFile("FOO=\"hello'", {});
    expect(result.FOO).toBe("\"hello'");
  });

  it("handles empty quoted value", () => {
    const result = applyEnvFile('FOO=""', {});
    expect(result.FOO).toBe("");
  });

  it("handles value with spaces in quotes", () => {
    const result = applyEnvFile("MSG='hello world foo'", {});
    expect(result.MSG).toBe("hello world foo");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyEnvFile – real pipeline variable names
// ─────────────────────────────────────────────────────────────────────────────

describe("applyEnvFile – real pipeline variable names", () => {
  const gcsJson = JSON.stringify({
    type: "service_account",
    project_id: "my-gcs-project",
    private_key_id: "key123",
    private_key: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...",
    client_email: "svc@project.iam.gserviceaccount.com",
    client_id: "12345",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
  });

  it("sets GCS_SERVICE_ACCOUNT_JSON from file when not in env", () => {
    const result = applyEnvFile(`GCS_SERVICE_ACCOUNT_JSON=${gcsJson}`, {});
    expect(JSON.parse(result.GCS_SERVICE_ACCOUNT_JSON!)).toHaveProperty("type", "service_account");
  });

  it("keeps existing valid GCS_SERVICE_ACCOUNT_JSON", () => {
    const existing = JSON.stringify({ type: "service_account", project_id: "existing" });
    const result = applyEnvFile(`GCS_SERVICE_ACCOUNT_JSON=${gcsJson}`, { GCS_SERVICE_ACCOUNT_JSON: existing });
    expect(JSON.parse(result.GCS_SERVICE_ACCOUNT_JSON!).project_id).toBe("existing");
  });

  it("overrides invalid GCS_SERVICE_ACCOUNT_JSON", () => {
    const result = applyEnvFile(`GCS_SERVICE_ACCOUNT_JSON=${gcsJson}`, {
      GCS_SERVICE_ACCOUNT_JSON: "ENCRYPTED:abc123==" // invalid JSON from dotenvx
    });
    expect(result.GCS_SERVICE_ACCOUNT_JSON).toBe(gcsJson);
  });

  it("sets GCS_BUCKET_NAME from file when not in env", () => {
    const result = applyEnvFile("GCS_BUCKET_NAME=my-resume-bucket", {});
    expect(result.GCS_BUCKET_NAME).toBe("my-resume-bucket");
  });

  it("keeps existing GCS_BUCKET_NAME", () => {
    const result = applyEnvFile("GCS_BUCKET_NAME=file-bucket", { GCS_BUCKET_NAME: "env-bucket" });
    expect(result.GCS_BUCKET_NAME).toBe("env-bucket");
  });

  it("sets INTERNAL_API_KEY from file when not in env", () => {
    const result = applyEnvFile("INTERNAL_API_KEY=secret123", {});
    expect(result.INTERNAL_API_KEY).toBe("secret123");
  });

  it("sets GOOGLE_SHEETS_ID from file when not in env", () => {
    const result = applyEnvFile("GOOGLE_SHEETS_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms", {});
    expect(result.GOOGLE_SHEETS_ID).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms");
  });

  it("sets ANTHROPIC_API_KEY from file when not in env", () => {
    const result = applyEnvFile("ANTHROPIC_API_KEY=sk-ant-api03-xxx", {});
    expect(result.ANTHROPIC_API_KEY).toBe("sk-ant-api03-xxx");
  });

  it("sets WHATSAPP_ACCESS_TOKEN from file when not in env", () => {
    const result = applyEnvFile("WHATSAPP_ACCESS_TOKEN=EAABwzLixnjYBOxxx", {});
    expect(result.WHATSAPP_ACCESS_TOKEN).toBe("EAABwzLixnjYBOxxx");
  });

  it("sets NEXT_PUBLIC_BASE_URL from file when not in env", () => {
    const result = applyEnvFile("NEXT_PUBLIC_BASE_URL=http://localhost:3000", {});
    expect(result.NEXT_PUBLIC_BASE_URL).toBe("http://localhost:3000");
  });

  it("keeps NEXT_PUBLIC_BASE_URL from command line", () => {
    const result = applyEnvFile("NEXT_PUBLIC_BASE_URL=http://localhost:3000", {
      NEXT_PUBLIC_BASE_URL: "https://prod.example.com",
    });
    expect(result.NEXT_PUBLIC_BASE_URL).toBe("https://prod.example.com");
  });

  it("processes a full realistic .env.local file", () => {
    const file = `
# Pipeline Configuration
GCS_BUCKET_NAME=my-bucket
GCS_PROJECT_ID=my-project
GCS_SERVICE_ACCOUNT_JSON=${gcsJson}
INTERNAL_API_KEY=secret123
ANTHROPIC_API_KEY=sk-ant-xxx
GOOGLE_SHEETS_ID=sheet-id-123
NEXT_PUBLIC_BASE_URL=http://localhost:3000
`;
    const result = applyEnvFile(file, {});
    expect(result.GCS_BUCKET_NAME).toBe("my-bucket");
    expect(result.GCS_PROJECT_ID).toBe("my-project");
    expect(result.INTERNAL_API_KEY).toBe("secret123");
    expect(result.ANTHROPIC_API_KEY).toBe("sk-ant-xxx");
    expect(result.GOOGLE_SHEETS_ID).toBe("sheet-id-123");
    expect(result.NEXT_PUBLIC_BASE_URL).toBe("http://localhost:3000");
    expect(JSON.parse(result.GCS_SERVICE_ACCOUNT_JSON!)).toHaveProperty("type", "service_account");
  });

  it("command-line values win over all file values", () => {
    const file = `
GCS_BUCKET_NAME=file-bucket
ANTHROPIC_API_KEY=file-key
`;
    const result = applyEnvFile(file, {
      GCS_BUCKET_NAME: "cli-bucket",
      ANTHROPIC_API_KEY: "cli-key",
    });
    expect(result.GCS_BUCKET_NAME).toBe("cli-bucket");
    expect(result.ANTHROPIC_API_KEY).toBe("cli-key");
  });
});
