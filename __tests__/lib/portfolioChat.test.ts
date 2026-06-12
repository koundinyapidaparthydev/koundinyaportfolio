import {
  buildPortfolioContext,
  buildPortfolioSystemPrompt,
  trimChatHistory,
} from "@/lib/portfolioChat";
import { resumeData } from "@/data/resume";

describe("portfolioChat helpers", () => {
  it("builds context containing name and projects", () => {
    const context = buildPortfolioContext(resumeData);
    expect(context).toContain("Koundinya Pidaparthy");
    expect(context).toContain("projects");
  });

  it("system prompt instructs the model to stay within portfolio context", () => {
    const prompt = buildPortfolioSystemPrompt('{"name":"Koundinya Pidaparthy"}');
    expect(prompt).toContain("ONLY the portfolio context");
    expect(prompt).toContain("Koundinya_Pidaparthy_resume.pdf");
  });

  it("trims chat history to the most recent messages", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: "user" as const,
      content: `message ${i}`,
    }));
    expect(trimChatHistory(messages)).toHaveLength(12);
    expect(trimChatHistory(messages).at(-1)?.content).toBe("message 19");
  });
});
