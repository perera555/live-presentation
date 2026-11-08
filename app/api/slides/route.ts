import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { DeckSchema } from "@/lib/types";

export const maxDuration = 120;

const client = new Anthropic();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim().slice(0, 200);
  const prompt = String(body?.prompt ?? "").trim().slice(0, 4000);
  const slideCount = Math.min(Math.max(Number(body?.slideCount) || 6, 3), 15);
  const presenterName = String(body?.presenterName ?? "").trim().slice(0, 80);

  if (!title) {
    return Response.json({ error: "Please enter a presentation title." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local or Vercel env vars." },
      { status: 500 },
    );
  }

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(DeckSchema) },
      system:
        "You write university-level presentations. Content must be accurate, well structured (intro, body, conclusion) and easy to follow when spoken aloud. The script for each slide is what the presenter says; it should flow naturally from slide to slide, sound like a confident student talking, and not just read the bullets.",
      messages: [
        {
          role: "user",
          content: `Create a presentation with exactly ${slideCount} slides.
Title: ${title}
${presenterName ? `Presenter name: ${presenterName} (introduce yourself on the first slide)\n` : ""}Instructions from the presenter:
${prompt || "(none — choose a sensible structure for the title)"}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "This topic could not be generated. Try rephrasing it." }, { status: 422 });
    }
    const deck = response.parsed_output;
    if (!deck) {
      return Response.json({ error: "Could not parse the generated slides. Please try again." }, { status: 502 });
    }
    return Response.json(deck);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Invalid ANTHROPIC_API_KEY." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Too many requests — wait a moment and retry." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `AI error ${error.status}: ${error.message}` }, { status: 502 });
    }
    throw error;
  }
}
