import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    console.error("Stripe env vars missing");
    return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  // Read raw body for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature" }), { status: 400 });
  }

  // Verify Stripe webhook signature
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  // Use service role client — webhooks act on behalf of the system
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = pi.metadata || {};

      console.log(`PaymentIntent succeeded: ${pi.id}`, meta);

      // Update any pending transaction that used this payment intent
      // (in case the frontend already called activate_project_after_payment,
      //  this just confirms the stripe_payment_intent_id is stored)
      if (meta.project_id) {
        await supabase
          .from("transactions")
          .update({
            mock_tx_id: pi.id, // reuse mock_tx_id column for stripe PI id
            status: "completed",
          })
          .eq("project_id", meta.project_id)
          .eq("status", "completed"); // only update if already activated by frontend
      }

      return new Response(
        JSON.stringify({ received: true, event: event.type }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = pi.metadata || {};
      const lastError = pi.last_payment_error;

      console.warn(`PaymentIntent failed: ${pi.id}`, lastError?.message);

      // Notify owner of failed payment
      if (meta.owner_id) {
        await supabase.from("notifications").insert({
          user_id: meta.owner_id,
          type: "project_update",
          title: "Payment Failed",
          message: `Your payment could not be processed: ${lastError?.message || "Card declined"}. Please try again.`,
          metadata: { project_id: meta.project_id, payment_intent_id: pi.id },
        });
      }

      return new Response(
        JSON.stringify({ received: true, event: event.type }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All other events — acknowledge receipt
    return new Response(
      JSON.stringify({ received: true, event: event.type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Handler error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
