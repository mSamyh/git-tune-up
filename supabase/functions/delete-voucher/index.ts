import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { redemption_id } = await req.json();

    if (!redemption_id) {
      return new Response(
        JSON.stringify({ error: 'Redemption ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the redemption belongs to the user and get details
    const { data: redemption, error: fetchError } = await supabaseAdmin
      .from('redemption_history')
      .select('donor_id, points_spent, status')
      .eq('id', redemption_id)
      .single();

    if (fetchError || !redemption) {
      console.error('Error fetching redemption:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Redemption not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check ownership
    if (redemption.donor_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only delete your own vouchers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified (can't delete verified vouchers)
    if (redemption.status === 'verified') {
      return new Response(
        JSON.stringify({ error: 'Cannot delete verified vouchers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the redemption using service role
    const { error: deleteError } = await supabaseAdmin
      .from('redemption_history')
      .delete()
      .eq('id', redemption_id);

    if (deleteError) {
      console.error('Error deleting redemption:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete voucher' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refund points
    const { data: currentPoints } = await supabaseAdmin
      .from('donor_points')
      .select('total_points')
      .eq('donor_id', user.id)
      .single();

    if (currentPoints) {
      await supabaseAdmin
        .from('donor_points')
        .update({ 
          total_points: currentPoints.total_points + redemption.points_spent,
          updated_at: new Date().toISOString()
        })
        .eq('donor_id', user.id);

      // Record refund transaction
      await supabaseAdmin
        .from('points_transactions')
        .insert({
          donor_id: user.id,
          points: redemption.points_spent,
          transaction_type: 'refunded',
          description: 'Voucher deleted - points refunded',
          related_redemption_id: redemption_id,
        });
    }

    console.log(`Voucher deleted successfully: ${redemption_id} by user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Voucher deleted successfully',
        points_refunded: redemption.points_spent
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-voucher function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
