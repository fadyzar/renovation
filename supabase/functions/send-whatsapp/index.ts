import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  if (!digits || digits.length < 9) return null;

  let normalized = digits;
  if (normalized.startsWith("972")) {
    // already has country code
  } else if (normalized.startsWith("0")) {
    normalized = "972" + normalized.slice(1);
  } else {
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
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sendWhatsApp(phone, message);

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
