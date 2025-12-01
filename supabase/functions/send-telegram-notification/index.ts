import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramNotificationRequest {
  eventType: string;
  message: string;
  details?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { eventType, message, details }: TelegramNotificationRequest = await req.json();

    console.log('Processing Telegram notification:', { eventType, message });

    // Fetch Telegram configuration
    const { data: config, error: configError } = await supabase
      .from('telegram_config')
      .select('*')
      .eq('is_enabled', true)
      .single();

    if (configError || !config) {
      console.log('No active Telegram configuration found');
      return new Response(
        JSON.stringify({ success: true, message: 'No Telegram config active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { bot_token, admin_chat_ids } = config;

    if (!bot_token || !admin_chat_ids || admin_chat_ids.length === 0) {
      console.log('Telegram config incomplete');
      return new Response(
        JSON.stringify({ success: true, message: 'Telegram config incomplete' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Format the message with details
    let formattedMessage = `🔔 *${eventType}*\n\n${message}`;
    
    if (details) {
      formattedMessage += '\n\n📋 *Details:*';
      for (const [key, value] of Object.entries(details)) {
        formattedMessage += `\n• *${key}:* ${value}`;
      }
    }

    formattedMessage += `\n\n⏰ ${new Date().toLocaleString()}`;

    // Log the notification attempt
    const { data: logEntry } = await supabase
      .from('telegram_notification_logs')
      .insert({
        event_type: eventType,
        message: formattedMessage,
        status: 'pending'
      })
      .select()
      .single();

    // Send to all admin chat IDs
    const results = [];
    for (const chatId of admin_chat_ids) {
      try {
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${bot_token}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: formattedMessage,
              parse_mode: 'Markdown'
            })
          }
        );

        const result = await telegramResponse.json();
        results.push({ chatId, success: result.ok, result });

        if (!result.ok) {
          console.error(`Failed to send to ${chatId}:`, result);
        }
      } catch (error: any) {
        console.error(`Error sending to ${chatId}:`, error);
        results.push({ chatId, success: false, error: error.message });
      }
    }

    // Update log status
    const allSuccessful = results.every(r => r.success);
    await supabase
      .from('telegram_notification_logs')
      .update({
        status: allSuccessful ? 'sent' : 'failed',
        error_message: allSuccessful ? null : JSON.stringify(results.filter(r => !r.success))
      })
      .eq('id', logEntry?.id);

    return new Response(
      JSON.stringify({ 
        success: allSuccessful, 
        results,
        message: allSuccessful ? 'Notifications sent successfully' : 'Some notifications failed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-telegram-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});