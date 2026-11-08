import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const maxDuration = 60;

const client = new Anthropic();

const Questions = z.object({
  questions: z.array(z.string()).describe("6-8 realistic interview questions, from easy warm-up to harder ones"),
});

const Feedback = z.object({
  score: z.number().describe("1-10 rating of the answer"),
  strengths: z.array(z.string()).describe("1-3 specific things that were good"),
  improve: z.array(z.string()).describe("1-3 specific, actionable improvements"),
  betterAnswer: z
    .string()
    .describe("A stronger version of THEIR answer, in their own voice, keeping their real facts; 60-120 words"),
});

// Interview PRACTICE: generates likely questions, and gives feedback on a practice answer.
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });
  }
  const body = await request.json().catch(() => null);
  const role = String(body?.role ?? "").trim().slice(0, 200);
  const details = String(body?.details ?? "").trim().slice(0, 2000);
  if (!role) return Response.json({ error: "Tell me what the interview is for." }, { status: 400 });

  const system =
    "You are a friendly, honest interview coach helping a university student practise before a real interview. Be encouraging but specific.";

  try {
    if (body?.action === "questions") {
      const res = await client.beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(Questions) },
        system,
        messages: [
          { role: "user", content: `Interview for: ${role}\n${details ? `About me / the role: ${details}` : ""}\nGive me practice questions.` },
        ],
      });
      if (!res.parsed_output) throw new Error("No questions returned");
      return Response.json(res.parsed_output);
    }

    if (body?.action === "feedback") {
      const question = String(body?.question ?? "").slice(0, 1000);
      const answer = String(body?.answer ?? "").trim().slice(0, 6000);
      if (!question || !answer) return Response.json({ error: "Answer the question first." }, { status: 400 });
      const res = await client.beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: betaZodOutputFormat(Feedback) },
        system,
        messages: [
          {
            role: "user",
            content: `Interview for: ${role}\n${details ? `Context: ${details}\n` : ""}Question: ${question}\nMy practice answer (spoken, transcribed): ${answer}\nGive me feedback.`,
          },
        ],
      });
      if (!res.parsed_output) throw new Error("No feedback returned");
      return Response.json(res.parsed_output);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `AI error ${error.status}: ${error.message}` }, { status: 502 });
    }
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
