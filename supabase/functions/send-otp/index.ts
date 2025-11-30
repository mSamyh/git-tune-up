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
    const { phone } = await req.json();

    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in database with 10 minute expiry
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: dbError } = await supabase
      .from('otp_verifications')
      .insert({
        phone,
        otp,
        expires_at: expiresAt.toISOString()
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store OTP');
    }

    // Send SMS via Textbee
    const textbeeApiKey = Deno.env.get('TEXTBEE_API_KEY');
    const textbeeDeviceId = Deno.env.get('TEXTBEE_DEVICE_ID');
    
    if (!textbeeApiKey || !textbeeDeviceId) {
      throw new Error('TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID must be configured');
    }

    const message = `Your Blood Donor verification code is: ${otp}. Valid for 10 minutes.`;

    const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${textbeeDeviceId}/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': textbeeApiKey,
      },
      body: JSON.stringify({
        recipients: [phone],
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Textbee error:', errorText);
      throw new Error('Failed to send SMS');
    }

    console.log('OTP sent successfully to', phone);

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-otp function:', error);
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