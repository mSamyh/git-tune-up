import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      donor_id, 
      donation_date, 
      hospital_name, 
      units_donated = 1,
      notes = null,
      blood_request_id = null,
      send_notification = true
    } = await req.json();

    // Validate required fields
    if (!donor_id || !donation_date || !hospital_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: donor_id, donation_date, hospital_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing donation:', { donor_id, donation_date, hospital_name });

    // 1. Insert donation record
    const { data: donation, error: donationError } = await supabase
      .from('donation_history')
      .insert({
        donor_id,
        donation_date,
        hospital_name,
        units_donated,
        notes,
        blood_request_id
      })
      .select()
      .single();

    if (donationError) {
      console.error('Error inserting donation:', donationError);
      throw donationError;
    }

    console.log('Donation inserted:', donation.id);

    // 2. Award points using the secure database function
    const { data: pointsResult, error: pointsError } = await supabase
      .rpc('award_donation_points_secure', {
        p_donor_id: donor_id,
        p_donation_id: donation.id,
        p_hospital_name: hospital_name
      });

    if (pointsError) {
      console.error('Error awarding points:', pointsError);
      // Don't throw - donation was successful, points can be fixed later
    }

    console.log('Points result:', pointsResult);

    // 3. Sync last donation date
    const { error: syncError } = await supabase
      .rpc('sync_donor_last_donation', {
        p_donor_id: donor_id
      });

    if (syncError) {
      console.error('Error syncing last donation:', syncError);
    }

    // 4. Send Telegram notification if enabled
    if (send_notification) {
      try {
        // Fetch donor info
        const { data: donor } = await supabase
          .from('profiles')
          .select('full_name, blood_group')
          .eq('id', donor_id)
          .single();

        if (donor) {
          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              event_type: 'new_donation',
              message: `🩸 New Donation Recorded!\n\nDonor: ${donor.full_name}\nBlood Type: ${donor.blood_group}\nHospital: ${hospital_name}\nDate: ${donation_date}\nPoints Awarded: ${pointsResult?.points || 0}`
            }
          });
        }
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        // Don't throw - notification is not critical
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        donation: donation,
        points_awarded: pointsResult?.points || 0,
        points_status: pointsResult?.success ? 'awarded' : pointsResult?.reason || 'unknown'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing donation:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
