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
    const { message, groups } = await req.json();

    if (!message || !groups || groups.length === 0) {
      throw new Error('Message and at least one group are required');
    }

    console.log('Broadcasting SMS to groups:', groups);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Build query based on selected groups
    let query = supabase
      .from('profiles')
      .select('phone, full_name, availability_status')
      .in('user_type', ['donor', 'both']);

    // If not "all", filter by specific statuses
    if (!groups.includes('all')) {
      query = query.in('availability_status', groups);
    }

    const { data: donors, error: fetchError } = await query;

    if (fetchError) {
      console.error('Database error:', fetchError);
      throw new Error('Failed to fetch donors');
    }

    if (!donors || donors.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No donors found in selected groups', sentCount: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const textbeeApiKey = Deno.env.get('TEXTBEE_API_KEY');
    const textbeeDeviceId = Deno.env.get('TEXTBEE_DEVICE_ID');
    
    if (!textbeeApiKey || !textbeeDeviceId) {
      throw new Error('TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID must be configured');
    }

    const phoneNumbers = donors.map(d => d.phone);

    // Log SMS attempts
    const smsLogPromises = donors.map(donor => 
      supabase.from('sms_logs').insert({
        recipient_phone: donor.phone,
        recipient_name: donor.full_name,
        message_body: message,
        status: 'pending',
      })
    );

    await Promise.all(smsLogPromises);

    // Send SMS via Textbee
    const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${textbeeDeviceId}/send-sms`, {
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
      
      await supabase
        .from('sms_logs')
        .update({ 
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: errorText
        })
        .in('recipient_phone', phoneNumbers)
        .eq('status', 'pending');
      
      throw new Error('Failed to send SMS broadcast');
    }

    // Update SMS logs to sent status
    await supabase
      .from('sms_logs')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .in('recipient_phone', phoneNumbers)
      .eq('status', 'pending');

    console.log(`SMS broadcast sent to ${phoneNumbers.length} donors`);

    // Send Telegram notification
    try {
      const { data: config } = await supabase
        .from('telegram_config')
        .select('*')
        .eq('is_enabled', true)
        .single();

      if (config && config.bot_token && config.admin_chat_ids.length > 0) {
        const groupLabels = groups.includes('all') ? 'All Donors' : groups.join(', ');
        
        const telegramMessage = `📢 *SMS Broadcast Sent*

*Groups:* ${groupLabels}
*Recipients:* ${phoneNumbers.length} donors

*Message:*
${message}

⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Indian/Maldives', dateStyle: 'medium', timeStyle: 'medium' })} (MVT)`;

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

        await supabase
          .from('telegram_notification_logs')
          .insert({
            event_type: 'SMS Broadcast',
            message: telegramMessage,
            status: 'sent'
          });
      }
    } catch (telegramError) {
      console.error('Telegram notification error:', telegramError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Broadcast sent to ${phoneNumbers.length} donors`,
        sentCount: phoneNumbers.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in broadcast-sms function:', error);
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
