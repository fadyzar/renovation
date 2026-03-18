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
}

const ANALYSIS_PROMPT = `You are an expert renovation estimator analyzing photos of a residential space.
Your job is to extract measurement data and renovation-relevant observations from these photos.

Return a JSON object with EXACTLY these fields (use null for anything you cannot determine):
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
  "detected_features": <array of strings — e.g. ["hardwood_floor", "popcorn_ceiling", "crown_molding", "tile_backsplash", "recessed_lighting", "exposed_brick", "built_in_cabinets", "fireplace", "skylight"]>,
  "estimated_complexity": <"low" | "medium" | "high" — based on visible condition and renovation scope>,
  "scan_confidence": <number 0-100 — your confidence in these estimates based on photo quality and visibility>,
  "scan_summary": <1-2 sentence plain English summary of what you see>,
  "renovation_notes": <1-3 sentences of renovation-specific observations — materials, condition, access challenges, anything useful for a contractor bidding on this space>
}

Be conservative with measurements — if you cannot clearly estimate a dimension, return null rather than guessing.
High confidence (80-100): clear photos, reference objects visible, multiple angles.
Medium confidence (50-79): one photo, partial view, or obstructions present.
Low confidence (0-49): dark, blurry, or minimal visual information.

Return ONLY valid JSON, no extra text.`;

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
        max_tokens: 1024,
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

  return new Response(
    JSON.stringify({
      measurements,
      ai_analysis_payload: aiData,  // Full response stored for audit/debugging
      photo_count: photoUrls.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
