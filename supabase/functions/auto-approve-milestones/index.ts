import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    // Find milestones that are past their auto-approve deadline
    const { data: expiredMilestones, error: findError } = await supabase
      .from('milestones')
      .select('id, transaction_id, title, auto_approve_deadline')
      .eq('status', 'awaiting_approval')
      .eq('auto_approved', false)
      .lt('auto_approve_deadline', new Date().toISOString());

    if (findError) {
      throw findError;
    }

    if (!expiredMilestones || expiredMilestones.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No milestones to auto-approve',
          count: 0
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const results = [];

    // Auto-approve each expired milestone
    for (const milestone of expiredMilestones) {
      try {
        // Update milestone to approved
        const { error: updateError } = await supabase
          .from('milestones')
          .update({
            status: 'approved',
            auto_approved: true,
            approved_at: new Date().toISOString()
          })
          .eq('id', milestone.id)
          .eq('status', 'awaiting_approval');

        if (updateError) {
          console.error(`Error auto-approving milestone ${milestone.id}:`, updateError);
          results.push({ milestone_id: milestone.id, success: false, error: updateError.message });
          continue;
        }

        // Log audit trail
        await supabase.rpc('log_audit', {
          p_entity_type: 'milestone',
          p_entity_id: milestone.id,
          p_action: 'auto_approved',
          p_new_state: {
            status: 'approved',
            auto_approved: true,
            deadline_passed: milestone.auto_approve_deadline
          }
        });

        // Auto-release funds
        const { error: releaseError } = await supabase.rpc('release_milestone_funds', {
          p_milestone_id: milestone.id
        });

        if (releaseError) {
          console.error(`Error releasing funds for milestone ${milestone.id}:`, releaseError);
          results.push({ milestone_id: milestone.id, success: false, error: releaseError.message });
          continue;
        }

        results.push({ milestone_id: milestone.id, success: true });
        console.log(`Auto-approved and released funds for milestone ${milestone.id}`);

      } catch (error) {
        console.error(`Error processing milestone ${milestone.id}:`, error);
        results.push({
          milestone_id: milestone.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Auto-approved ${successCount} of ${results.length} milestones`,
        total: results.length,
        successful: successCount,
        results
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error('Error in auto-approve function:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
