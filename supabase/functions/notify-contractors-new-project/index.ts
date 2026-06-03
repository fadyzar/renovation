import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const smtpHost     = Deno.env.get("SMTP_HOST");
    const smtpPort     = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser     = Deno.env.get("SMTP_USER");
    const smtpPass     = Deno.env.get("SMTP_PASS");
    const fromEmail    = Deno.env.get("FROM_EMAIL") || smtpUser;
    const fromName     = Deno.env.get("FROM_NAME") || "MGBiT";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "projectId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to read data
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get project details
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("id, title, description, budget_min, budget_max, work_types, city, state, property_city, property_state")
      .eq("id", projectId)
      .single();

    if (projError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active contractors with email
    const { data: contractors, error: contError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "contractor")
      .not("email", "is", null);

    if (contError || !contractors?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No contractors found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const location = project.property_city || project.city || "Unknown location";
    const state    = project.property_state || project.state || "";
    const budget   = project.budget_min && project.budget_max
      ? `$${Number(project.budget_min).toLocaleString()} – $${Number(project.budget_max).toLocaleString()}`
      : "Budget not specified";
    const workTypes = Array.isArray(project.work_types) && project.work_types.length
      ? project.work_types.join(", ")
      : "General renovation";

    const appUrl = Deno.env.get("APP_URL") || "https://mgbit.com";

    // Send emails via SMTP using fetch to a simple SMTP relay
    let sent = 0;
    const errors: string[] = [];

    for (const contractor of contractors) {
      if (!contractor.email) continue;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">MGBiT</h1>
            <p style="color:#a8c4e0;margin:8px 0 0;font-size:14px;">New Project Available</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:35px 40px;">
            <p style="color:#333;font-size:16px;margin:0 0 20px;">
              Hi ${contractor.full_name || "Contractor"},
            </p>
            <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 25px;">
              A new project just became available on MGBiT that may match your expertise.
            </p>

            <!-- Project Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dde8f5;border-radius:10px;margin-bottom:25px;">
              <tr>
                <td style="padding:25px;">
                  <h2 style="color:#1e3a5f;font-size:20px;margin:0 0 15px;">${project.title}</h2>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;width:120px;">📍 Location</td>
                      <td style="padding:6px 0;color:#333;font-size:14px;font-weight:bold;">${location}${state ? ", " + state : ""}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;">💰 Budget</td>
                      <td style="padding:6px 0;color:#333;font-size:14px;font-weight:bold;">${budget}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;">🔧 Work Type</td>
                      <td style="padding:6px 0;color:#333;font-size:14px;font-weight:bold;">${workTypes}</td>
                    </tr>
                  </table>

                  ${project.description ? `
                  <p style="color:#555;font-size:14px;line-height:1.6;margin:15px 0 0;padding-top:15px;border-top:1px solid #e8eef8;">
                    ${project.description.slice(0, 200)}${project.description.length > 200 ? "..." : ""}
                  </p>` : ""}
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${appUrl}/projects"
                     style="display:inline-block;background:#e85d04;color:#ffffff;font-size:16px;font-weight:bold;padding:14px 36px;border-radius:8px;text-decoration:none;">
                    View Project &amp; Submit Bid →
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#888;font-size:13px;text-align:center;margin:25px 0 0;line-height:1.6;">
              You're receiving this because you're a registered contractor on MGBiT.<br>
              <a href="${appUrl}/settings" style="color:#1e3a5f;">Manage notifications</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="color:#aaa;font-size:12px;margin:0;">
              MGBiT · 21550 Oxnard St, Suite 300, Woodland Hills, CA 91367<br>
              855-826-4248 · office@mgbit.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      try {
        // Use Supabase's SMTP via nodemailer-style fetch
        const emailRes = await fetch(`https://${smtpHost}:${smtpPort}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => null);

        // Fallback: use smtp2go or similar REST-based SMTP
        // We'll use a simple SMTP connection via the built-in approach
        const { SmtpClient } = await import("https://deno.land/x/smtp@v0.7.0/mod.ts");
        const client = new SmtpClient();

        await client.connectTLS({
          hostname: smtpHost,
          port: smtpPort,
          username: smtpUser,
          password: smtpPass,
        });

        await client.send({
          from: `${fromName} <${fromEmail}>`,
          to: contractor.email,
          subject: `🔧 New Project: ${project.title} — Submit Your Bid`,
          content: `New project available: ${project.title} in ${location}. Budget: ${budget}. Log in to MGBiT to submit your bid: ${appUrl}/projects`,
          html,
        });

        await client.close();
        sent++;
      } catch (emailErr) {
        console.error(`Failed to send to ${contractor.email}:`, emailErr);
        errors.push(contractor.email);
      }
    }

    console.log(`Sent ${sent}/${contractors.length} emails for project ${projectId}`);

    return new Response(
      JSON.stringify({ sent, total: contractors.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("notify-contractors error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
