import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store pending broadcasts in memory (chat_id -> { groups: string[], step: string })
const pendingBroadcasts: Map<string, { groups: string[], step: string }> = new Map();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Telegram config
    const { data: config } = await supabase
      .from('telegram_config')
      .select('*')
      .eq('is_enabled', true)
      .maybeSingle();

    if (!config || !config.bot_token) {
      console.log('Telegram not configured');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const update = await req.json();
    console.log('Telegram update:', JSON.stringify(update));

    const botToken = config.bot_token;
    const adminChatIds = config.admin_chat_ids || [];

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id.toString();
      const data = callbackQuery.data;

      // Check if user is admin
      if (!adminChatIds.includes(chatId)) {
        await sendTelegramMessage(botToken, chatId, "⛔ You are not authorized to use this bot.");
        await answerCallbackQuery(botToken, callbackQuery.id, "Not authorized");
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pending = pendingBroadcasts.get(chatId) || { groups: [], step: 'select' };

      if (data.startsWith('group_')) {
        const group = data.replace('group_', '');
        
        if (group === 'all') {
          pending.groups = ['all'];
        } else if (pending.groups.includes('all')) {
          pending.groups = [group];
        } else if (pending.groups.includes(group)) {
          pending.groups = pending.groups.filter(g => g !== group);
        } else {
          pending.groups.push(group);
        }
        
        pendingBroadcasts.set(chatId, pending);
        
        // Update message with new selection
        await updateGroupSelectionMessage(botToken, chatId, callbackQuery.message.message_id, pending.groups);
        await answerCallbackQuery(botToken, callbackQuery.id, group === 'all' ? "All donors selected" : `${group} toggled`);
      } else if (data === 'confirm_groups') {
        if (pending.groups.length === 0) {
          await answerCallbackQuery(botToken, callbackQuery.id, "Please select at least one group");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        pending.step = 'message';
        pendingBroadcasts.set(chatId, pending);
        
        const groupLabels = pending.groups.includes('all') ? 'All Donors' : pending.groups.join(', ');
        await sendTelegramMessage(botToken, chatId, `✅ Selected groups: *${groupLabels}*\n\n📝 Now type your broadcast message:`);
        await answerCallbackQuery(botToken, callbackQuery.id, "Now type your message");
      } else if (data === 'cancel_broadcast') {
        pendingBroadcasts.delete(chatId);
        await sendTelegramMessage(botToken, chatId, "❌ Broadcast cancelled.");
        await answerCallbackQuery(botToken, callbackQuery.id, "Cancelled");
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle messages
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id.toString();
      const text = message.text || '';

      // Check if user is admin
      if (!adminChatIds.includes(chatId)) {
        await sendTelegramMessage(botToken, chatId, "⛔ You are not authorized to use this bot.\n\nYour Chat ID: `" + chatId + "`\n\nAsk an admin to add your Chat ID to the authorized list.");
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /start command
      if (text === '/start') {
        await sendTelegramMessage(botToken, chatId, 
          "🩸 *LeyHadhiya Admin Bot*\n\n" +
          "Available commands:\n" +
          "• /broadcast - Send SMS to donor groups\n" +
          "• /stats - View donor statistics\n" +
          "• /help - Show this message"
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /help command
      if (text === '/help') {
        await sendTelegramMessage(botToken, chatId, 
          "🩸 *LeyHadhiya Admin Bot Help*\n\n" +
          "*Commands:*\n" +
          "• /broadcast - Start SMS broadcast wizard\n" +
          "• /stats - View donor statistics\n" +
          "• /help - Show this message\n\n" +
          "*Broadcast Flow:*\n" +
          "1. Use /broadcast\n" +
          "2. Select donor groups\n" +
          "3. Type your message\n" +
          "4. Confirm to send"
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /stats command
      if (text === '/stats') {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('availability_status')
          .in('user_type', ['donor', 'both']);

        if (profiles) {
          const available = profiles.filter(p => p.availability_status === 'available').length;
          const unavailable = profiles.filter(p => p.availability_status === 'unavailable').length;
          const reserved = profiles.filter(p => p.availability_status === 'reserved').length;
          const total = profiles.length;

          await sendTelegramMessage(botToken, chatId,
            "📊 *Donor Statistics*\n\n" +
            `✅ Available: ${available}\n` +
            `⏳ Unavailable: ${unavailable}\n` +
            `🔒 Reserved: ${reserved}\n` +
            `━━━━━━━━━━━━━━\n` +
            `👥 Total: ${total}`
          );
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /broadcast command
      if (text === '/broadcast') {
        pendingBroadcasts.set(chatId, { groups: [], step: 'select' });
        await sendGroupSelectionMessage(botToken, chatId, supabase);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle message input for broadcast
      const pending = pendingBroadcasts.get(chatId);
      if (pending && pending.step === 'message') {
        const broadcastMessage = text;
        const groups = pending.groups;
        
        // Clear pending
        pendingBroadcasts.delete(chatId);

        // Send confirmation with the message
        const groupLabels = groups.includes('all') ? 'All Donors' : groups.join(', ');
        await sendTelegramMessage(botToken, chatId,
          `📢 *Broadcasting SMS...*\n\n` +
          `*Groups:* ${groupLabels}\n` +
          `*Message:*\n${broadcastMessage}\n\n` +
          `⏳ Sending...`
        );

        // Actually send the broadcast
        const result = await sendSMSBroadcast(supabase, groups, broadcastMessage);

        if (result.success) {
          await sendTelegramMessage(botToken, chatId,
            `✅ *Broadcast Sent Successfully!*\n\n` +
            `📱 SMS sent to *${result.sentCount}* donors\n` +
            `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Indian/Maldives', dateStyle: 'medium', timeStyle: 'medium' })} (MVT)`
          );
        } else {
          await sendTelegramMessage(botToken, chatId, `❌ *Broadcast Failed*\n\n${result.error}`);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in telegram-bot-webhook:', error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text
    })
  });
}

async function sendGroupSelectionMessage(botToken: string, chatId: string, supabase: any) {
  // Get counts
  const { data: profiles } = await supabase
    .from('profiles')
    .select('availability_status')
    .in('user_type', ['donor', 'both']);

  const available = profiles?.filter((p: any) => p.availability_status === 'available').length || 0;
  const unavailable = profiles?.filter((p: any) => p.availability_status === 'unavailable').length || 0;
  const reserved = profiles?.filter((p: any) => p.availability_status === 'reserved').length || 0;
  const total = profiles?.length || 0;

  const keyboard = {
    inline_keyboard: [
      [{ text: `📢 All Donors (${total})`, callback_data: 'group_all' }],
      [{ text: `✅ Available (${available})`, callback_data: 'group_available' }],
      [{ text: `⏳ Unavailable (${unavailable})`, callback_data: 'group_unavailable' }],
      [{ text: `🔒 Reserved (${reserved})`, callback_data: 'group_reserved' }],
      [
        { text: '✅ Confirm', callback_data: 'confirm_groups' },
        { text: '❌ Cancel', callback_data: 'cancel_broadcast' }
      ]
    ]
  };

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: "📢 *SMS Broadcast*\n\nSelect donor groups to send SMS to:\n\n_Tap groups to select/deselect, then confirm_",
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  });
}

async function updateGroupSelectionMessage(botToken: string, chatId: string, messageId: number, selectedGroups: string[]) {
  const checkMark = (group: string) => selectedGroups.includes(group) || selectedGroups.includes('all') ? '☑️' : '⬜';

  const keyboard = {
    inline_keyboard: [
      [{ text: `${checkMark('all')} All Donors`, callback_data: 'group_all' }],
      [{ text: `${checkMark('available')} Available`, callback_data: 'group_available' }],
      [{ text: `${checkMark('unavailable')} Unavailable`, callback_data: 'group_unavailable' }],
      [{ text: `${checkMark('reserved')} Reserved`, callback_data: 'group_reserved' }],
      [
        { text: '✅ Confirm', callback_data: 'confirm_groups' },
        { text: '❌ Cancel', callback_data: 'cancel_broadcast' }
      ]
    ]
  };

  const selectedText = selectedGroups.length > 0 
    ? `\n\n✅ Selected: ${selectedGroups.includes('all') ? 'All Donors' : selectedGroups.join(', ')}`
    : '';

  await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: `📢 *SMS Broadcast*\n\nSelect donor groups to send SMS to:${selectedText}`,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  });
}

async function sendSMSBroadcast(supabase: any, groups: string[], message: string): Promise<{ success: boolean; sentCount?: number; error?: string }> {
  try {
    // Build query based on selected groups
    let query = supabase
      .from('profiles')
      .select('phone, full_name, availability_status')
      .in('user_type', ['donor', 'both']);

    if (!groups.includes('all')) {
      query = query.in('availability_status', groups);
    }

    const { data: donors, error: fetchError } = await query;

    if (fetchError) {
      console.error('Database error:', fetchError);
      return { success: false, error: 'Failed to fetch donors' };
    }

    if (!donors || donors.length === 0) {
      return { success: false, error: 'No donors found in selected groups' };
    }

    const textbeeApiKey = Deno.env.get('TEXTBEE_API_KEY');
    const textbeeDeviceId = Deno.env.get('TEXTBEE_DEVICE_ID');
    
    if (!textbeeApiKey || !textbeeDeviceId) {
      return { success: false, error: 'SMS service not configured' };
    }

    const phoneNumbers = donors.map((d: any) => d.phone);

    // Log SMS attempts
    const smsLogPromises = donors.map((donor: any) => 
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
      
      return { success: false, error: 'SMS service error' };
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

    return { success: true, sentCount: phoneNumbers.length };
  } catch (error) {
    console.error('Error sending SMS broadcast:', error);
    return { success: false, error: 'Failed to send broadcast' };
  }
}
