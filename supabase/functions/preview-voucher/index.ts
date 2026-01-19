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

    // Fetch the redemption record with reward details - READ ONLY, no updates
    const { data: redemption, error: fetchError } = await supabase
      .from('redemption_history')
      .select(`
        *,
        reward_catalog (
          id,
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

    console.log('Voucher preview requested:', redemption.id, 'Status:', redemption.status);

    // Check if reward program is still active
    const rewardProgramActive = redemption.reward_catalog?.is_active ?? false;

    // Load donor profile details
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

    // Check current status
    const now = new Date();
    const expiresAt = new Date(redemption.expires_at);
    const isExpired = now > expiresAt;
    const isAlreadyVerified = redemption.status === 'verified';

    // If already verified, get merchant info
    let verifiedByMerchant = null;
    if (isAlreadyVerified && redemption.verified_by_merchant_id) {
      const { data: merchant } = await supabase
        .from('merchant_accounts')
        .select('name')
        .eq('id', redemption.verified_by_merchant_id)
        .maybeSingle();
      verifiedByMerchant = merchant?.name;
    }

    // Determine if voucher is valid for redemption
    const isValid = !isExpired && !isAlreadyVerified;

    // Determine display status
    let displayStatus: 'pending' | 'verified' | 'expired' = 'pending';
    if (isAlreadyVerified) {
      displayStatus = 'verified';
    } else if (isExpired) {
      displayStatus = 'expired';
    }

    console.log('Voucher preview complete. Status:', displayStatus, 'Valid:', isValid);

    return new Response(
      JSON.stringify({
        success: true,
        is_valid: isValid,
        status: displayStatus,
        voucher_code: redemption.voucher_code,
        expires_at: redemption.expires_at,
        verified_at: redemption.verified_at,
        verified_by_merchant: verifiedByMerchant,
        reward: {
          id: redemption.reward_catalog?.id,
          title: redemption.reward_catalog?.title,
          description: redemption.reward_catalog?.description,
          partner_name: redemption.reward_catalog?.partner_name,
          points_required: redemption.reward_catalog?.points_required,
        },
        customer: {
          full_name: donorProfile?.full_name,
          phone: donorProfile?.phone,
        },
        tier: {
          name: donorTier.name,
          discount: donorTier.discount,
          current_points: currentPoints,
        },
        reward_program_active: rewardProgramActive,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in preview-voucher function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
