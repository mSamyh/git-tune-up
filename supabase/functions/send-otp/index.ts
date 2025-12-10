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

    // Validate phone number format: must be 7 digits starting with 7 or 9
    const phoneRegex = /^[79]\d{6}$/;
    if (!phoneRegex.test(phone)) {
      throw new Error('Invalid phone number. Must be 7 digits starting with 7 or 9');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in database with 10 minute expiry
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Delete any old OTP records for this phone to avoid conflicts
    await supabase
      .from('otp_verifications')
      .delete()
      .eq('phone', phone);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: dbError } = await supabase
      .from('otp_verifications')
      .insert({
        phone,
        otp,
        expires_at: expiresAt.toISOString(),
        verified: false
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

    // Send Telegram notification for OTP (in background - don't await)
    const sendTelegramNotification = async () => {
      try {
        // Fetch Telegram configuration
        const { data: config } = await supabase
          .from('telegram_config')
          .select('*')
          .eq('is_enabled', true)
          .single();

        if (!config || !config.bot_token || config.admin_chat_ids.length === 0) {
          console.log('Telegram not configured, skipping notification');
          return;
        }

        const telegramMessage = `📱 *New OTP Sent*

*Phone:* ${phone}
*OTP Code:* \`${otp}\`
*Purpose:* User Registration/Verification
*Expires At:* ${expiresAt.toLocaleString('en-US', { timeZone: 'Indian/Maldives', dateStyle: 'medium', timeStyle: 'medium' })} (MVT)

⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Indian/Maldives', dateStyle: 'medium', timeStyle: 'medium' })} (MVT)`;

        // Send to all admin chat IDs
        for (const chatId of config.admin_chat_ids) {
          await fetch(
            `https://api.telegram.org/bot${config.bot_token}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: telegramMessage,
                parse_mode: 'Markdown'
              })
            }
          );
        }

        // Log the notification
        await supabase
          .from('telegram_notification_logs')
          .insert({
            event_type: 'OTP Sent',
            message: telegramMessage,
            status: 'sent'
          });

        console.log('Telegram notification sent for OTP');
      } catch (error: any) {
        console.error('Failed to send Telegram notification:', error);
      }
    };

    // Start background task for Telegram notification (don't await)
    sendTelegramNotification().catch(err => console.error('Telegram notification error:', err));

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