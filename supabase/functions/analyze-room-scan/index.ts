import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScanRequest {
  photo_urls: string[];   // Public URLs in the scan-photos storage bucket
  room_type_hint?: string; // e.g. "Kitchen", "Bathroom" — from renovation type
}

interface AiQuote {
  estimated_min: number;          // USD, rounded to nearest $500
  estimated_max: number;          // USD, rounded to nearest $500
  currency: "USD";
  breakdown: string[];            // 3–6 line items: "Flooring: $2,000–$4,000"
  key_cost_drivers: string[];     // 2–4 main factors driving cost
  rationale: string;              // 2–3 sentence explanation referencing what you see
}

interface RoomMeasurements {
  room_length_ft: number | null;
  room_width_ft: number | null;
  room_height_ft: number | null;
  measured_area_sqft: number | null;
  wall_area_sqft: number | null;
  window_count: number | null;
  door_count: number | null;
  room_count: number;
  detected_room_type: string | null;
  detected_features: string[];
  estimated_complexity: "low" | "medium" | "high";
  scan_confidence: number;  // 0-100
  scan_summary: string;
  renovation_notes: string;
  ai_quote: AiQuote | null;
}

const ANALYSIS_PROMPT = `You are an expert renovation estimator with 20+ years of experience analyzing residential spaces.
Analyze the photos and return a single JSON object with EXACTLY these fields (use null for anything you cannot determine):

{
  "room_length_ft": <number or null — estimated room length in feet>,
  "room_width_ft": <number or null — estimated room width in feet>,
  "room_height_ft": <number or null — estimated ceiling height in feet, typically 8-10>,
  "measured_area_sqft": <number or null — floor area in sq ft>,
  "wall_area_sqft": <number or null — total paintable wall area in sq ft>,
  "window_count": <integer or null>,
  "door_count": <integer or null>,
  "room_count": <integer, default 1>,
  "detected_room_type": <string — e.g. "kitchen", "bathroom", "bedroom", "living_room", "basement">,
  "detected_features": <array of strings from this list only: ["hardwood_floor", "tile_floor", "carpet", "popcorn_ceiling", "crown_molding", "recessed_lighting", "exposed_brick", "built_in_cabinets", "fireplace", "skylight", "tile_backsplash", "bay_window", "vaulted_ceiling"]>,
  "estimated_complexity": <"low" | "medium" | "high" — based on visible condition and renovation scope>,
  "scan_confidence": <number 0-100 — your confidence in these estimates based on photo quality and visibility>,
  "scan_summary": <1-2 sentence plain English summary of what you see>,
  "renovation_notes": <1-3 sentences of renovation-specific observations — materials, condition, access challenges, anything useful for a contractor bidding on this space>,
  "ai_quote": {
    "estimated_min": <integer — minimum renovation cost in USD, rounded to nearest 500>,
    "estimated_max": <integer — maximum renovation cost in USD, rounded to nearest 500>,
    "currency": "USD",
    "breakdown": <array of 3-6 strings, each a cost line item like "Cabinetry & countertops: $8,000–$15,000">,
    "key_cost_drivers": <array of 2-4 short strings naming what drives the cost, e.g. ["custom cabinetry", "full gut renovation", "high-end finishes"]>,
    "rationale": <2-3 sentences explaining the estimate based on what you actually see in the photos — reference specific visible elements>
  }
}

MEASUREMENT RULES:
- Be conservative — return null rather than guessing a dimension you cannot see clearly
- High confidence (80-100): clear photos, reference objects visible, multiple angles
- Medium confidence (50-79): one photo, partial view, or obstructions present
- Low confidence (0-49): dark, blurry, or minimal visual information

PRICING RULES (US national averages, adjust for visible quality level):
- Kitchen full renovation: $15,000–$80,000 depending on size, materials, layout changes
- Bathroom full renovation: $8,000–$35,000
- Bedroom renovation: $3,000–$15,000
- Living room: $4,000–$20,000
- Basement finish: $10,000–$35,000
- Painting only: $1,500–$5,000
- Flooring only: $2,000–$8,000
- Factor in detected features: built-in cabinets add $5k–$12k, fireplace $3k–$8k, vaulted ceiling $4k–$8k
- Complexity multipliers: low = 0.7x, medium = 1.0x, high = 1.4x
- If photo quality is too low to estimate cost reliably, set ai_quote to null

Return ONLY valid JSON, no extra text, no markdown fences.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: ScanRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.photo_urls || body.photo_urls.length === 0) {
    return new Response(JSON.stringify({ error: "photo_urls is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cap at 5 photos to stay within token limits
  const photoUrls = body.photo_urls.slice(0, 5);

  // Build content blocks: one per image + final text prompt
  const contentBlocks: object[] = photoUrls.map((url) => ({
    type: "image",
    source: { type: "url", url },
  }));

  const promptText = body.room_type_hint
    ? `${ANALYSIS_PROMPT}\n\nNote: The owner indicated this is a ${body.room_type_hint} renovation. Use this as context if the photo is ambiguous.`
    : ANALYSIS_PROMPT;

  contentBlocks.push({ type: "text", text: promptText });

  let aiResponse: Response;
  try {
    aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to reach Anthropic API", detail: String(err) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    return new Response(
      JSON.stringify({ error: "Anthropic API error", detail: errText }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const aiData = await aiResponse.json();
  const rawText: string = aiData?.content?.[0]?.text ?? "";

  let measurements: RoomMeasurements;
  try {
    // Strip markdown fences if present
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    measurements = JSON.parse(jsonText);
  } catch {
    return new Response(
      JSON.stringify({
        error: "AI returned unparseable response",
        raw: rawText,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Extract ai_quote from measurements before storing measurements separately
  const { ai_quote, ...measurementsOnly } = measurements;

  return new Response(
    JSON.stringify({
      measurements: measurementsOnly,
      ai_quote: ai_quote ?? null,
      ai_analysis_payload: aiData,  // Full response stored for audit/debugging
      photo_count: photoUrls.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
