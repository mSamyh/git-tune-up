import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tier defaults aligned with database (Bronze: 0, Silver: 500, Gold: 1000, Platinum: 2000)
const DEFAULT_TIERS = [
  { name: 'Platinum', discount: 15, minPoints: 2000 },
  { name: 'Gold', discount: 10, minPoints: 1000 },
  { name: 'Silver', discount: 5, minPoints: 500 },
  { name: 'Bronze', discount: 0, minPoints: 0 },
];

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

    // SECURITY: Merchant ID is now REQUIRED for verification
    if (!merchant_id) {
      console.error('Verification attempt without merchant_id');
      return new Response(
        JSON.stringify({ error: 'Merchant authentication required. Please enter your merchant PIN to verify this voucher.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Validate merchant - REQUIRED
    const { data: merchantAccount, error: merchantError } = await supabase
      .from('merchant_accounts')
      .select('id, name, partner_id, is_active')
      .eq('id', merchant_id)
      .maybeSingle();

    if (merchantError) {
      console.error('Error fetching merchant:', merchantError);
      return new Response(
        JSON.stringify({ error: 'Error validating merchant account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!merchantAccount) {
      console.error('Merchant not found:', merchant_id);
      return new Response(
        JSON.stringify({ error: 'Merchant account not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!merchantAccount.is_active) {
      console.error('Merchant inactive:', merchant_id);
      return new Response(
        JSON.stringify({ error: 'This merchant account is inactive' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if merchant is linked to a specific reward and if it matches
    if (merchantAccount.partner_id && merchantAccount.partner_id !== redemption.reward_id) {
      console.error('Merchant-reward mismatch. Merchant partner_id:', merchantAccount.partner_id, 'Reward ID:', redemption.reward_id);
      return new Response(
        JSON.stringify({ 
          error: `This merchant (${merchantAccount.name}) is not authorized to verify this reward. Please use the correct merchant PIN.`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Use database values with aligned defaults
    const tiers = [
      { name: 'Platinum', discount: settingsMap.tier_platinum_discount ?? 15, minPoints: settingsMap.tier_platinum_min ?? 2000 },
      { name: 'Gold', discount: settingsMap.tier_gold_discount ?? 10, minPoints: settingsMap.tier_gold_min ?? 1000 },
      { name: 'Silver', discount: settingsMap.tier_silver_discount ?? 5, minPoints: settingsMap.tier_silver_min ?? 500 },
      { name: 'Bronze', discount: settingsMap.tier_bronze_discount ?? 0, minPoints: settingsMap.tier_bronze_min ?? 0 },
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
          error: `This voucher has already been redeemed${merchantName ? ` by ${merchantName}` : ''}`,
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
          error: 'This voucher has expired',
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

    // Build update object
    const updateData: Record<string, any> = {
      status: 'verified',
      verified_at: now.toISOString(),
      verified_by_merchant_id: merchant_id
    };

    // Verify the QR code
    const { error: updateError } = await supabase
      .from('redemption_history')
      .update(updateData)
      .eq('id', redemption.id);

    if (updateError) {
      console.error('Error updating redemption:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify voucher. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Voucher ${voucher_code} verified by merchant ${merchantAccount.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Voucher verified successfully',
        warning: warningMessage,
        reward_program_active: rewardProgramActive,
        redemption: {
          ...redemption,
          status: 'verified',
          verified_at: now.toISOString(),
          verified_by_merchant_id: merchant_id,
        },
        profiles: donorProfile,
        verified_by_merchant: merchantAccount.name,
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
      JSON.stringify({ error: 'Internal server error. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
