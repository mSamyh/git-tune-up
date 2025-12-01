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

    console.log('Starting expired voucher cleanup...');

    // Step 1: Find all expired vouchers that are still 'pending'
    const { data: expiredVouchers, error: fetchError } = await supabase
      .from('redemption_history')
      .select('id, donor_id, points_spent, voucher_code, expires_at')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired vouchers:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredVouchers?.length || 0} expired vouchers to process`);

    // Step 2: Process each expired voucher
    if (expiredVouchers && expiredVouchers.length > 0) {
      for (const voucher of expiredVouchers) {
        console.log(`Processing expired voucher: ${voucher.voucher_code}`);

        // Refund points
        const { error: refundError } = await supabase.rpc('refund_expired_voucher', {
          p_donor_id: voucher.donor_id,
          p_points: voucher.points_spent
        });

        if (refundError) {
          console.error(`Failed to refund points for voucher ${voucher.voucher_code}:`, refundError);
          // Continue with other vouchers even if one fails
          continue;
        }

        // Log transaction
        await supabase
          .from('points_transactions')
          .insert({
            donor_id: voucher.donor_id,
            points: voucher.points_spent,
            transaction_type: 'refunded',
            description: `Voucher expired - points auto-refunded (${voucher.voucher_code})`,
            related_redemption_id: voucher.id,
          });

        // Update voucher status
        await supabase
          .from('redemption_history')
          .update({ status: 'expired' })
          .eq('id', voucher.id);

        console.log(`Refunded ${voucher.points_spent} points for voucher ${voucher.voucher_code}`);
      }
    }

    // Step 3: Delete vouchers that have been expired for more than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: oldExpiredVouchers, error: deleteError } = await supabase
      .from('redemption_history')
      .delete()
      .eq('status', 'expired')
      .lt('expires_at', sevenDaysAgo.toISOString())
      .select('voucher_code');

    if (deleteError) {
      console.error('Error deleting old expired vouchers:', deleteError);
    } else {
      console.log(`Deleted ${oldExpiredVouchers?.length || 0} old expired vouchers (>7 days)`);
    }

    const summary = {
      expired_and_refunded: expiredVouchers?.length || 0,
      deleted_old_vouchers: oldExpiredVouchers?.length || 0,
      timestamp: new Date().toISOString(),
    };

    console.log('Cleanup completed:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        ...summary,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-expired-vouchers function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Cleanup failed', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
