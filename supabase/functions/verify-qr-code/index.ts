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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { voucher_code } = await req.json();

    if (!voucher_code) {
      return new Response(
        JSON.stringify({ error: 'Voucher code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the redemption record
    const { data: redemption, error: fetchError } = await supabase
      .from('redemption_history')
      .select(`
        *,
        reward_catalog (
          title,
          description,
          partner_name,
          points_required
        ),
        profiles (
          full_name,
          phone
        )
      `)
      .eq('voucher_code', voucher_code)
      .single();

    if (fetchError || !redemption) {
      console.error('Error fetching redemption:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Invalid QR code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (redemption.status === 'verified') {
      return new Response(
        JSON.stringify({
          error: 'This voucher has already been used',
          redemption
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(redemption.expires_at);
    
    if (now > expiresAt) {
      // Update status to expired
      await supabase
        .from('redemption_history')
        .update({ status: 'expired' })
        .eq('id', redemption.id);

      return new Response(
        JSON.stringify({
          error: 'This QR code has expired',
          redemption
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the QR code
    const { error: updateError } = await supabase
      .from('redemption_history')
      .update({
        status: 'verified',
        verified_at: now.toISOString()
      })
      .eq('id', redemption.id);

    if (updateError) {
      console.error('Error updating redemption:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify QR code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('QR code verified successfully:', voucher_code);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'QR code verified successfully',
        redemption: {
          ...redemption,
          status: 'verified',
          verified_at: now.toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-qr-code function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});