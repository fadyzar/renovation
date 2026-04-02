import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MessageCheckRequest {
  message: string;
  conversationId: string;
  senderId: string;
}

interface ViolationResult {
  hasViolation: boolean;
  violationType?: string;
  detectedPattern?: string;
  severity?: string;
  explanation?: string;
  sanitizedMessage?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { message, conversationId, senderId }: MessageCheckRequest = await req.json();

    if (!message || !conversationId || !senderId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const claudeApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!claudeApiKey) {
      console.warn("ANTHROPIC_API_KEY not set, using pattern-based detection only");
      const patternResult = await checkWithPatterns(message);

      return new Response(
        JSON.stringify(patternResult),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiResult = await checkWithAI(message, claudeApiKey);

    if (aiResult.hasViolation) {
      await logViolation(conversationId, senderId, message, aiResult);
    }

    return new Response(
      JSON.stringify(aiResult),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in monitor-chat-message:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        hasViolation: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function checkWithAI(message: string, apiKey: string): Promise<ViolationResult> {
  const prompt = `You are a content moderator for a home renovation platform that connects homeowners with contractors. Your job is to detect if users are trying to exchange contact information to bypass the platform.

Analyze this message and determine if it contains:
- Phone numbers (in any format)
- Email addresses
- Social media handles (Instagram, WhatsApp, Facebook, etc.)
- Requests to "call me", "text me", "email me"
- Attempts to share contact info indirectly
- URLs or website links
- Other attempts to move conversation off-platform

Message to analyze: "${message}"

Respond ONLY with valid JSON in this exact format:
{
  "hasViolation": true/false,
  "violationType": "phone_number" | "email" | "social_media" | "bypass_attempt" | "external_contact" | null,
  "detectedPattern": "the actual pattern found" | null,
  "severity": "low" | "medium" | "high" | "critical" | null,
  "explanation": "brief explanation",
  "sanitizedMessage": "message with violations removed" | null
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", await response.text());
      return await checkWithPatterns(message);
    }

    const data = await response.json();
    const content = data.content[0].text;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return await checkWithPatterns(message);
  } catch (error) {
    console.error("Error calling Claude API:", error);
    return await checkWithPatterns(message);
  }
}

async function checkWithPatterns(message: string): Promise<ViolationResult> {
  const patterns = {
    phone: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10}/gi,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    socialMedia: /@[\w.]+|whatsapp|instagram|facebook|telegram|signal/gi,
    bypassAttempt: /call\s+me|text\s+me|email\s+me|dm\s+me|contact\s+me\s+at/gi,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    const match = message.match(pattern);
    if (match) {
      return {
        hasViolation: true,
        violationType: type === "phone" ? "phone_number" :
                      type === "email" ? "email" :
                      type === "socialMedia" ? "social_media" : "bypass_attempt",
        detectedPattern: match[0],
        severity: type === "phone" || type === "email" ? "high" : "medium",
        explanation: `Detected ${type} in message`,
        sanitizedMessage: message.replace(pattern, "[REMOVED]"),
      };
    }
  }

  return {
    hasViolation: false,
  };
}

async function logViolation(
  conversationId: string,
  senderId: string,
  originalMessage: string,
  result: ViolationResult
) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase credentials");
      return;
    }

    await fetch(`${supabaseUrl}/rest/v1/chat_violations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        violator_id: senderId,
        violation_type: result.violationType,
        detected_pattern: result.detectedPattern,
        original_message: originalMessage,
        severity: result.severity,
        action_taken: result.severity === "high" || result.severity === "critical"
          ? "message_blocked"
          : "warning",
      }),
    });
  } catch (error) {
    console.error("Error logging violation:", error);
  }
}
