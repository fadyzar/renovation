import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.21.0";
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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      amount, projectId, bidId, ownerId, contractorId,
      projectTitle, productName, successUrl, cancelUrl,
      // Optional: the stage being paid. Sent by the web and app 1.1+; older
      // app builds omit it and are matched against the unpaid stages.
      milestoneId,
    } = body;

    if (user.id !== ownerId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /*
     * The amount is decided by the server, not the client.
     *
     * `checkout_expected_payment` (service role only) derives it from the
     * accepted quote — the first stage's price, or 25% of the total when the
     * quote has no schedule — or from the stage being paid, and refuses
     * projects that are not the caller's or not waiting for a payment. A
     * checkout for any other amount is never created, so nobody is charged an
     * amount the project cannot be activated with. `verify-checkout-session`
     * checks the paid session against the same rule again.
     */
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: expected, error: expectedError } = await admin.rpc("checkout_expected_payment", {
      p_project_id: projectId,
      p_bid_id: bidId ?? null,
      p_owner_id: user.id,
      p_milestone_id: milestoneId ?? null,
    });
    if (expectedError) {
      const forbidden = expectedError.message.includes("not_project_owner");
      return new Response(
        JSON.stringify({ error: forbidden ? "Forbidden" : expectedError.message }),
        { status: forbidden ? 403 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestedCents = Math.round(Number(amount) * 100);
    const kind: string = expected.kind;
    let stageId: string | null = milestoneId ?? null;

    if (kind === "ambiguous_stage") {
      // Older app: no milestone id. The amount must be exactly one unpaid stage.
      const { data: stages } = await admin
        .from("milestones")
        .select("id, amount, status, order_index")
        .eq("project_id", projectId)
        .neq("status", "paid")
        .order("order_index");
      const match = (stages ?? []).find(
        (m: { amount: number }) => Math.abs(Math.round(Number(m.amount) * 100) - requestedCents) <= 1
      );
      if (!match) {
        return new Response(
          JSON.stringify({ error: "That amount does not match any unpaid stage of this project." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      stageId = match.id;
    } else if (Math.abs(requestedCents - Number(expected.amount_cents)) > 1) {
      return new Response(
        JSON.stringify({
          error: "The payment amount does not match the accepted quote.",
          expectedAmount: Number(expected.amount_cents) / 100,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: requestedCents,
            product_data: {
              name: productName ?? `Milestone Payment`,
              description: projectTitle ?? `Project ${projectId}`,
            },
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      metadata: {
        project_id: projectId,
        bid_id: bidId,
        owner_id: ownerId,
        contractor_id: contractorId,
        type: "milestone_payment",
        // Read by verify-checkout-session: which rule this session was priced by.
        kind: kind === "first_payment" ? "first_payment" : "milestone",
        ...(stageId ? { milestone_id: stageId } : {}),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log(`Checkout Session created: ${session.id} for $${amount}`);

    return new Response(
      JSON.stringify({ sessionUrl: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("create-checkout-session error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
