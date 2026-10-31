// Server-only: load via dynamic import inside server handlers.
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, type ModelMessage } from "ai";
import type { z } from "zod";
import { createLovableAiGatewayRunIdFetch, withLovableAiGatewayRunIdHeader } from "./run-id";

export const AI_MODEL = "openai/gpt-6-astra";
const BASE_URL = "https://ai.gateway.lovable.dev/v1";

function makeProvider(runId?: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  const runIdFetch = createLovableAiGatewayRunIdFetch(runId);
  const provider = createOpenAI({
    baseURL: BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { provider, runIdFetch };
}

const providerOptions = {
  openai: {
    store: false,
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  },
} as const;

export function streamChat(request: Request, instructions: string, messages: ModelMessage[]) {
  const { provider, runIdFetch } = makeProvider(request.headers.get("X-Lovable-AIG-Run-ID") ?? undefined);
  const result = streamText({
    model: provider.responses(AI_MODEL),
    instructions,
    messages,
    abortSignal: request.signal,
    providerOptions,
  });
  return withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse(), runIdFetch);
}

/** Streams a structured JSON response and returns the parsed final object. */
export async function generateStructured<T>(schema: z.ZodType<T>, instructions: string, prompt: string): Promise<T> {
  const { provider } = makeProvider();
  const result = streamText({
    model: provider.responses(AI_MODEL),
    instructions,
    messages: [{ role: "user", content: prompt }],
    output: Output.object({ schema }),
    providerOptions,
  });
  return (await result.output) as T;
}

export function describeAiError(e: unknown): string {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 429) return "AI is busy right now. Please wait a moment and try again.";
  if (status === 402) return "AI credits are used up. Please add credits to keep using AI features.";
  if (status === 403) return "AI access is not allowed for this request.";
  return e instanceof Error ? e.message : "AI request failed.";
}
