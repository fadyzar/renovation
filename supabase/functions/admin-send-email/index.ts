import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendResend, getAdminTemplate, ADMIN_TEMPLATES } from "../_shared/email.ts";

// Admin-only manual email sender. Picks a predefined (reusable) template and
// sends it to a specific user via Resend. Every send is logged to email_logs.
// All sending is server-side; the browser only triggers this function.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // List templates (so the admin UI can render the picker).
    if (req.method === "GET") {
      return json({ templates: ADMIN_TEMPLATES.map((t) => ({ id: t.id, label: t.label })) });
    }

    // ─── Verify caller is an admin ──────────────────────────────────────────
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: caller } = await supabase
      .from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (caller?.role !== "admin") return json({ error: "Forbidden — admin only" }, 403);

    // ─── Resolve template + recipient ───────────────────────────────────────
    const { user_id, template, vars } = await req.json();
    if (!user_id || !template) return json({ error: "user_id and template are required" }, 400);

    const tpl = getAdminTemplate(template);
    if (!tpl) return json({ error: `Unknown template "${template}"` }, 400);

    const { data: target } = await supabase
      .from("profiles").select("id, full_name, email").eq("id", user_id).maybeSingle();
    if (!target?.email) return json({ error: "Recipient has no email" }, 400);

    const email = tpl.build(vars ?? {}, target.full_name);
    const r = await sendResend(target.email, email.subject, email.html, email.text);

    await supabase.from("email_logs").insert({
      recipient_id: target.id,
      email: target.email,
      subject: email.subject,
      type: `admin:${template}`,
      status: r.ok ? "sent" : "failed",
      error: r.error ?? null,
      provider_id: r.id ?? null,
    });

    return json({ ok: r.ok, provider_id: r.id ?? null, error: r.error ?? null }, r.ok ? 200 : 502);
  } catch (err) {
    console.error("admin-send-email error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
