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

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature" }), { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};

      console.log(`Checkout session completed: ${session.id}`, meta);

      // Mark any pending transaction as confirmed
      if (meta.project_id) {
        await supabase
          .from("transactions")
          .update({ status: "completed", mock_tx_id: session.payment_intent as string })
          .eq("project_id", meta.project_id)
          .eq("status", "pending");

        // Notify owner
        if (meta.owner_id) {
          await supabase.from("notifications").insert({
            user_id: meta.owner_id,
            type: "project_update",
            title: "Payment Confirmed",
            message: "Your payment was confirmed by Stripe. Project is now active!",
            metadata: {
              project_id: meta.project_id,
              session_id: session.id,
            },
          });
        }
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = pi.metadata || {};

      console.log(`PaymentIntent succeeded: ${pi.id}`, meta);

      if (meta.project_id) {
        await supabase
          .from("transactions")
          .update({ mock_tx_id: pi.id, status: "completed" })
          .eq("project_id", meta.project_id)
          .eq("status", "completed");
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = pi.metadata || {};
      const lastError = pi.last_payment_error;

      console.warn(`PaymentIntent failed: ${pi.id}`, lastError?.message);

      if (meta.owner_id) {
        await supabase.from("notifications").insert({
          user_id: meta.owner_id,
          type: "project_update",
          title: "Payment Failed",
          message: `Your payment could not be processed: ${lastError?.message || "Card declined"}. Please try again.`,
          metadata: { project_id: meta.project_id, payment_intent_id: pi.id },
        });
      }
    }

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
