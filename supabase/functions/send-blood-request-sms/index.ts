import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bloodGroup, district, requestDetails } = await req.json();

    if (!bloodGroup || !district || !requestDetails) {
      throw new Error('Blood group, district, and request details are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch matching donors
    const { data: donors, error: fetchError } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('blood_group', bloodGroup)
      .eq('district', district)
      .eq('is_available', true);

    if (fetchError) {
      console.error('Database error:', fetchError);
      throw new Error('Failed to fetch donors');
    }

    if (!donors || donors.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No matching donors found', notifiedCount: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const textbeeApiKey = Deno.env.get('TEXTBEE_API_KEY');
    
    if (!textbeeApiKey) {
      throw new Error('TEXTBEE_API_KEY not configured');
    }

    const message = `URGENT: Blood needed! ${bloodGroup} blood required at ${requestDetails.hospitalName}. Patient: ${requestDetails.patientName}. Contact: ${requestDetails.contactName} (${requestDetails.contactPhone})`;

    // Send SMS to all matching donors
    const phoneNumbers = donors.map(d => d.phone);

    const response = await fetch('https://api.textbee.dev/api/v1/gateway/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': textbeeApiKey,
      },
      body: JSON.stringify({
        recipients: phoneNumbers,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Textbee error:', errorText);
      throw new Error('Failed to send SMS notifications');
    }

    console.log(`Blood request SMS sent to ${phoneNumbers.length} donors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notified ${phoneNumbers.length} donors`,
        notifiedCount: phoneNumbers.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-blood-request-sms function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});