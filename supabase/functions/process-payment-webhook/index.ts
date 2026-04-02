import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

interface StripeEvent {
  type: string;
  data: {
    object: {
      id: string;
      amount: number;
      currency: string;
      status: string;
      metadata?: {
        transaction_id?: string;
        milestone_id?: string;
        type?: 'initial_deposit' | 'milestone_payment';
      };
    };
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Stripe event
    const event: StripeEvent = await req.json();

    console.log('Processing payment event:', event.type);

    // Handle payment intent succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata || {};

      if (metadata.type === 'initial_deposit' && metadata.transaction_id) {
        // Call fund_initial_deposit function
        const { data, error } = await supabase.rpc('fund_initial_deposit', {
          p_transaction_id: metadata.transaction_id,
          p_payment_intent_id: paymentIntent.id,
        });

        if (error) {
          console.error('Error funding initial deposit:', error);
          throw error;
        }

        console.log('Initial deposit funded successfully:', metadata.transaction_id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Initial deposit funded',
            transaction_id: metadata.transaction_id
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      if (metadata.type === 'milestone_payment' && metadata.transaction_id) {
        // Call fund_next_milestone function
        const { data, error } = await supabase.rpc('fund_next_milestone', {
          p_transaction_id: metadata.transaction_id,
          p_payment_intent_id: paymentIntent.id,
        });

        if (error) {
          console.error('Error funding milestone:', error);
          throw error;
        }

        console.log('Milestone funded successfully:', metadata.transaction_id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Milestone funded',
            transaction_id: metadata.transaction_id
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // Handle payment intent failed
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata || {};

      // Log failure in audit trail
      if (metadata.transaction_id) {
        await supabase.rpc('log_audit', {
          p_entity_type: 'payment',
          p_entity_id: metadata.transaction_id,
          p_action: 'payment_failed',
          p_metadata: {
            payment_intent_id: paymentIntent.id,
            error: 'Payment failed'
          }
        });
      }

      console.log('Payment failed:', paymentIntent.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Event processed' }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
