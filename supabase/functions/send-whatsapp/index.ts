import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendWhatsApp } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Direct/manual WhatsApp sender (used by the admin sender UI via src/lib/whatsapp).
// All flag + test-mode enforcement lives in _shared/whatsapp.ts, so manual sends
// are rerouted to the test number in test mode just like automated notifications.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, message, recipient_id, recipient_type, event_type, project_id } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sendWhatsApp(phone, message);

    // Save log to DB (skip only the disabled kill-switch case — nothing was attempted).
    if (!result.skipped) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from("whatsapp_logs").insert({
          phone: result.to ?? phone,
          message,
          status: result.ok ? "sent" : "failed",
          error: result.error ?? null,
          recipient_id: recipient_id ?? null,
          recipient_type: recipient_type ?? null,
          event_type: event_type ?? "admin_manual",
          project_id: project_id ?? null,
        });
      } catch (logErr) {
        console.warn("Failed to save whatsapp log:", logErr);
      }
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
