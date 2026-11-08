import { z } from "zod";

export const SlideSchema = z.object({
  title: z.string().describe("Short slide heading, max ~8 words"),
  bullets: z
    .array(z.string())
    .describe("3-5 concise bullet points shown on the slide"),
  script: z
    .string()
    .describe(
      "What the presenter says aloud on this slide, in natural first-person spoken English, 40-90 words. No stage directions, no markdown.",
    ),
  emoji: z.string().describe("One emoji that represents the slide topic"),
});

export const DeckSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  slides: z.array(SlideSchema),
});

export type Slide = z.infer<typeof SlideSchema>;
export type Deck = z.infer<typeof DeckSchema>;

export type VoiceId = keyof typeof VOICES;

// Microsoft neural voices supported by D-ID's text-to-speech provider.
export const VOICES = {
  "en-US-JennyNeural": "Jenny — female, US",
  "en-US-AriaNeural": "Aria — female, US",
  "en-GB-SoniaNeural": "Sonia — female, UK",
  "en-US-GuyNeural": "Guy — male, US",
  "en-US-DavisNeural": "Davis — male, US",
  "en-GB-RyanNeural": "Ryan — male, UK",
  "en-IN-NeerjaNeural": "Neerja — female, India",
  "en-IN-PrabhatNeural": "Prabhat — male, India",
} as const;

export const FEMALE_VOICES: VoiceId[] = [
  "en-US-JennyNeural",
  "en-US-AriaNeural",
  "en-GB-SoniaNeural",
  "en-IN-NeerjaNeural",
];
export const MALE_VOICES: VoiceId[] = [
  "en-US-GuyNeural",
  "en-US-DavisNeural",
  "en-GB-RyanNeural",
  "en-IN-PrabhatNeural",
];

export type SlideVideo = {
  status: "idle" | "working" | "done" | "error";
  talkId?: string;
  url?: string;
  error?: string;
};
