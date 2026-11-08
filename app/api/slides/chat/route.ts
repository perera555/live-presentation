import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { DeckSchema } from "@/lib/types";

export const maxDuration = 120;

const client = new Anthropic();

const ChatResult = z.object({
  reply: z.string().describe("Short friendly message to the user describing what you changed (1-3 sentences)"),
  deck: DeckSchema.describe("The complete updated presentation"),
});

type ChatTurn = { role: "user" | "assistant"; content: string };

// ChatGPT-style editing: the user chats, Claude returns a reply plus the full updated deck.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const deck = DeckSchema.safeParse(body?.deck);
  const history: ChatTurn[] = Array.isArray(body?.messages) ? body.messages.slice(-20) : [];
  const turns = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!deck.success || !turns.length || turns.at(-1)!.role !== "user") {
    return Response.json({ error: "Missing presentation or message." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

  // Put the current deck in front of the latest user message so Claude edits the latest version.
  const last = turns.pop()!;
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...turns,
    {
      role: "user",
      content: `Current presentation (JSON):\n${JSON.stringify(deck.data)}\n\nMy request: ${last.content}`,
    },
  ];
  // The API requires the first message to be from the user.
  while (messages[0]?.role === "assistant") messages.shift();

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ChatResult) },
      system:
        "You are a presentation assistant inside a slide app, like a ChatGPT for presentations. The user chats with you to build and refine a university presentation. Apply their request to the current deck and return the COMPLETE updated deck (every slide, unchanged ones included) plus a short reply. Each slide has a title, 3-5 bullets, an emoji and a 'script' — the natural first-person words the presenter says aloud (40-90 words, no markdown). Keep scripts flowing naturally between slides. If the user asks a question rather than for a change, answer it in 'reply' and return the deck unchanged.",
      messages,
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "That request could not be completed. Try rephrasing it." }, { status: 422 });
    }
    if (!response.parsed_output) {
      return Response.json({ error: "Could not read the AI response. Please try again." }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Too many requests — wait a moment and retry." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `AI error ${error.status}: ${error.message}` }, { status: 502 });
    }
    throw error;
  }
}
