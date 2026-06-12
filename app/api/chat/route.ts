import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getResume } from "@/lib/resumeStore";
import {
  buildPortfolioContext,
  generatePortfolioChatReply,
  type ChatMessage,
} from "@/lib/portfolioChat";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid chat payload.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const messages = parsed.data.messages as ChatMessage[];
  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return NextResponse.json(
      { error: "The last message must be from the user." },
      { status: 422 }
    );
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Chat is not configured on this deployment. Set GEMINI_API_KEY locally or use the Contact section.",
      },
      { status: 503 }
    );
  }

  try {
    const resume = await getResume();
    const context = buildPortfolioContext(resume);
    const reply = await generatePortfolioChatReply(messages, context);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[POST /api/chat]", err);
    return NextResponse.json(
      { error: "Failed to generate a reply. Please try again." },
      { status: 500 }
    );
  }
}
