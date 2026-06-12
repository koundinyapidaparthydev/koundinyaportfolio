/**
 * @jest-environment jsdom
 */

import { sendPortfolioChat } from "@/components/AssistantBot";

describe("sendPortfolioChat", () => {
  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns reply from /api/chat on success", async () => {
    const fetchMock = jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "He works with React and Next.js." }),
    } as Response);

    const result = await sendPortfolioChat([
      { role: "user", content: "What are his skills?" },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.reply).toBe("He works with React and Next.js.");
  });

  it("returns API error message on failure", async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Chat is not configured" }),
    } as Response);

    const result = await sendPortfolioChat([
      { role: "user", content: "Hello" },
    ]);

    expect(result.error).toBe("Chat is not configured");
  });
});
