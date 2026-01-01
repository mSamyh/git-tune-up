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

    const { voucher_code, merchant_id } = await req.json();

    if (!voucher_code) {
      return new Response(
        JSON.stringify({ error: 'Voucher code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the redemption record with reward details
    const { data: redemption, error: fetchError } = await supabase
      .from('redemption_history')
      .select(`
        *,
        reward_catalog (
          title,
          description,
          partner_name,
          points_required,
          is_active
        )
      `)
      .eq('voucher_code', voucher_code)
      .maybeSingle();

    if (fetchError) {
      console.error('Database error fetching redemption:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Database error occurred' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!redemption) {
      console.error('No redemption found for voucher code:', voucher_code);
      return new Response(
        JSON.stringify({ error: 'Invalid voucher code. This QR code does not exist in our system.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if reward program is still active
    const rewardProgramActive = redemption.reward_catalog?.is_active ?? false;

    // Load donor profile details and points for tier calculation
    const { data: donorProfile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', redemption.donor_id)
      .maybeSingle();

    // Fetch donor points to calculate tier
    const { data: donorPoints } = await supabase
      .from('donor_points')
      .select('total_points, lifetime_points')
      .eq('donor_id', redemption.donor_id)
      .maybeSingle();

    // Fetch tier settings to calculate current tier
    const { data: tierSettings } = await supabase
      .from('reward_settings')
      .select('*')
      .in('setting_key', [
        'tier_bronze_min', 'tier_bronze_discount',
        'tier_silver_min', 'tier_silver_discount',
        'tier_gold_min', 'tier_gold_discount',
        'tier_platinum_min', 'tier_platinum_discount'
      ]);

    // Calculate tier based on current points
    const currentPoints = donorPoints?.total_points || 0;
    const settingsMap: Record<string, number> = {};
    tierSettings?.forEach(setting => {
      settingsMap[setting.setting_key] = parseInt(setting.setting_value);
    });

    const tiers = [
      { name: 'Platinum', discount: settingsMap.tier_platinum_discount || 20, minPoints: settingsMap.tier_platinum_min || 1000 },
      { name: 'Gold', discount: settingsMap.tier_gold_discount || 15, minPoints: settingsMap.tier_gold_min || 500 },
      { name: 'Silver', discount: settingsMap.tier_silver_discount || 10, minPoints: settingsMap.tier_silver_min || 100 },
      { name: 'Bronze', discount: settingsMap.tier_bronze_discount || 5, minPoints: settingsMap.tier_bronze_min || 0 },
    ];

    let donorTier = tiers[tiers.length - 1]; // Default to Bronze
    for (const tier of tiers) {
      if (currentPoints >= tier.minPoints) {
        donorTier = tier;
        break;
      }
    }

    // Check if already verified
    if (redemption.status === 'verified') {
      // Fetch merchant info if available
      let merchantName = null;
      if (redemption.verified_by_merchant_id) {
        const { data: merchant } = await supabase
          .from('merchant_accounts')
          .select('name')
          .eq('id', redemption.verified_by_merchant_id)
          .maybeSingle();
        merchantName = merchant?.name;
      }

      return new Response(
        JSON.stringify({
          error: 'This voucher has already been used',
          redemption,
          profiles: donorProfile,
          reward_program_active: rewardProgramActive,
          verified_by_merchant: merchantName
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
          redemption,
          profiles: donorProfile,
          reward_program_active: rewardProgramActive
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Warn if reward program is inactive but still allow verification
    let warningMessage = '';
    if (!rewardProgramActive) {
      warningMessage = 'Note: This reward program is currently inactive, but this voucher is still valid.';
    }

    // Build update object - include merchant_id if provided
    const updateData: Record<string, any> = {
      status: 'verified',
      verified_at: now.toISOString()
    };

    if (merchant_id) {
      updateData.verified_by_merchant_id = merchant_id;
    }

    // Verify the QR code
    const { error: updateError } = await supabase
      .from('redemption_history')
      .update(updateData)
      .eq('id', redemption.id);

    if (updateError) {
      console.error('Error updating redemption:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify QR code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch merchant name if merchant_id provided
    let merchantName = null;
    if (merchant_id) {
      const { data: merchant } = await supabase
        .from('merchant_accounts')
        .select('name')
        .eq('id', merchant_id)
        .maybeSingle();
      merchantName = merchant?.name;
    }

    console.log('QR code verified successfully:', voucher_code, 'by merchant:', merchant_id || 'unknown');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'QR code verified successfully',
        warning: warningMessage,
        reward_program_active: rewardProgramActive,
        redemption: {
          ...redemption,
          status: 'verified',
          verified_at: now.toISOString(),
          verified_by_merchant_id: merchant_id || null,
        },
        profiles: donorProfile,
        verified_by_merchant: merchantName,
        // Tier info for merchant to apply discount
        tier: {
          name: donorTier.name,
          discount: donorTier.discount,
          current_points: currentPoints,
        },
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