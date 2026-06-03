import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const INSTANCE_ID = Deno.env.get("GREENAPI_INSTANCE_ID") ?? "7107609079";
const API_TOKEN   = Deno.env.get("GREENAPI_API_TOKEN")   ?? "2ecdaa3dce4a4c0bb72f318d159280f339636ddb664a4a5388";

/**
 * Convert any phone format → WhatsApp chatId (e.g. "972541234567@c.us")
 * Handles: 054-1234567 / +972-54-1234567 / 0541234567 / 972541234567
 */
function toWhatsAppId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 7) return null;

  let normalized = digits;

  if (normalized.startsWith("972")) {
    // Israeli number with country code: 972XXXXXXXXX
  } else if (normalized.startsWith("1") && normalized.length === 11) {
    // US/Canada with country code: 1XXXXXXXXXX
  } else if (normalized.startsWith("44")) {
    // UK with country code
  } else if (normalized.startsWith("61")) {
    // Australia with country code
  } else if (normalized.startsWith("52")) {
    // Mexico with country code
  } else if (normalized.startsWith("0") && normalized.length === 10) {
    // Israeli local format: 05XXXXXXXX → 97205XXXXXXXX... wait, 0 + 9 digits = Israeli
    normalized = "972" + normalized.slice(1);
  } else if (normalized.length === 10 && !normalized.startsWith("0")) {
    // US local format (no country code): XXXXXXXXXX → 1XXXXXXXXXX
    normalized = "1" + normalized;
  } else if (normalized.length === 9 && normalized.startsWith("5")) {
    // Israeli mobile without leading 0: 5XXXXXXXX → 9725XXXXXXXX
    normalized = "972" + normalized;
  }

  return `${normalized}@c.us`;
}

async function sendWhatsApp(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const chatId = toWhatsAppId(phone);
  if (!chatId) return { ok: false, error: "Invalid phone number" };

  const url = `https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Green API error ${res.status}: ${body}`);
      return { ok: false, error: `Green API ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error("Green API fetch error:", err);
    return { ok: false, error: String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, message, recipient_id, project_id } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sendWhatsApp(phone, message);

    // Save log to DB
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("whatsapp_logs").insert({
        phone,
        message,
        status: result.ok ? "sent" : "failed",
        error: result.error ?? null,
        recipient_id: recipient_id ?? null,
        project_id: project_id ?? null,
      });
    } catch (logErr) {
      console.warn("Failed to save whatsapp log:", logErr);
    }

    return new Response(
      JSON.stringify(result),
      { status: result.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-whatsapp error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
