// Test helpers that fake the Anthropic Messages API over fetch.

export const VALID_ANALYSIS = {
  scores: {
    investment: 82,
    innovation: 85,
    team: 78,
    market: 80,
    technical_moat: 75,
    scalability: 88,
    developer_adoption: 90,
  },
  recommendation: "buy",
  summary: "A strong framework with rapid adoption.",
  strengths: ["Large community", "Clear architecture"],
  risks: ["Crowded market"],
  questions: ["What is the monetization path?"],
  growth_prediction: "Likely 3x stars in 12 months.",
  investment_thesis: "Category leader with network effects.",
  competitive_analysis: "Ahead of the two closest alternatives.",
};

interface MessageOptions {
  model?: string;
  stopReason?: string;
  stopDetails?: { category: string | null; explanation: string | null };
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * A 200 response in the Messages API shape. The answer is preceded by a
 * thinking block (as on Claude 5.5 models) so tests catch code that reads
 * content[0] instead of selecting the text block by type.
 */
export function messageResponse(options: MessageOptions = {}): Response {
  const {
    model = "claude-sonnet-5-5",
    stopReason = "end_turn",
    stopDetails,
    text = JSON.stringify(VALID_ANALYSIS),
    inputTokens = 2000,
    outputTokens = 800,
  } = options;
  const content =
    stopReason === "refusal"
      ? []
      : [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text },
        ];
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model,
      content,
      stop_reason: stopReason,
      stop_sequence: null,
      stop_details: stopDetails ?? null,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** An API error response; retry-after-ms keeps SDK retries fast in tests. */
export function errorResponse(status: number, message = "error"): Response {
  return new Response(
    JSON.stringify({
      type: "error",
      error: { type: "api_error", message },
    }),
    {
      status,
      headers: { "content-type": "application/json", "retry-after-ms": "1" },
    },
  );
}

/** The parsed JSON body and headers of the Nth fetch call. */
export function requestAt(
  mockFetch: { mock: { calls: unknown[][] } },
  index: number,
): { body: any; headers: Headers } {
  const [input, init] = mockFetch.mock.calls[index] as [
    RequestInfo | URL,
    RequestInit | undefined,
  ];
  const request = input instanceof Request ? input : undefined;
  const headers = new Headers(init?.headers ?? request?.headers);
  const rawBody = init?.body;
  return {
    body: typeof rawBody === "string" ? JSON.parse(rawBody) : undefined,
    headers,
  };
}
