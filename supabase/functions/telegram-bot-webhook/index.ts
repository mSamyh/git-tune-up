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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Telegram config
    const { data: config, error: configError } = await supabase
      .from('telegram_config')
      .select('*')
      .eq('is_enabled', true)
      .maybeSingle();

    if (configError) {
      console.error('Config fetch error:', configError);
    }

    if (!config || !config.bot_token) {
      console.log('Telegram not configured or disabled');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const update = await req.json();
    console.log('Telegram update received:', JSON.stringify(update, null, 2));

    const botToken = config.bot_token;
    const adminChatIds = config.admin_chat_ids || [];

    // Helper to get/create session from database
    async function getSession(chatId: string) {
      const { data, error } = await supabase
        .from('telegram_broadcast_sessions')
        .select('*')
        .eq('chat_id', chatId)
        .maybeSingle();
      
      if (error) console.error('Get session error:', error);
      return data;
    }

    async function upsertSession(chatId: string, groups: string[], step: string) {
      const { error } = await supabase
        .from('telegram_broadcast_sessions')
        .upsert({
          chat_id: chatId,
          groups: groups,
          step: step,
          updated_at: new Date().toISOString()
        }, { onConflict: 'chat_id' });
      
      if (error) console.error('Upsert session error:', error);
    }

    async function deleteSession(chatId: string) {
      const { error } = await supabase
        .from('telegram_broadcast_sessions')
        .delete()
        .eq('chat_id', chatId);
      
      if (error) console.error('Delete session error:', error);
    }

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id.toString();
      const data = callbackQuery.data;

      console.log('Callback query from chat:', chatId, 'data:', data);

      // Check if user is admin
      if (!adminChatIds.includes(chatId)) {
        console.log('User not authorized. Chat ID:', chatId, 'Allowed:', adminChatIds);
        await sendTelegramMessage(botToken, chatId, "⛔ You are not authorized to use this bot.\n\nYour Chat ID: `" + chatId + "`");
        await answerCallbackQuery(botToken, callbackQuery.id, "Not authorized");
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get session from database
      let session = await getSession(chatId);
      const pending = session || { groups: [], step: 'select' };

      if (data.startsWith('group_')) {
        const group = data.replace('group_', '');
        let groups = pending.groups || [];
        
        if (group === 'all') {
          groups = ['all'];
        } else if (groups.includes('all')) {
          groups = [group];
        } else if (groups.includes(group)) {
          groups = groups.filter((g: string) => g !== group);
        } else {
          groups = [...groups, group];
        }
        
        await upsertSession(chatId, groups, 'select');
        
        // Update message with new selection
        await updateGroupSelectionMessage(botToken, chatId, callbackQuery.message.message_id, groups);
        await answerCallbackQuery(botToken, callbackQuery.id, group === 'all' ? "All donors selected" : `${group} toggled`);
      } else if (data === 'confirm_groups') {
        const groups = pending.groups || [];
        if (groups.length === 0) {
          await answerCallbackQuery(botToken, callbackQuery.id, "Please select at least one group");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        await upsertSession(chatId, groups, 'message');
        
        const groupLabels = groups.includes('all') ? 'All Donors' : groups.join(', ');
        await sendTelegramMessage(botToken, chatId, `✅ Selected groups: *${groupLabels}*\n\n📝 Now type your broadcast message:`);
        await answerCallbackQuery(botToken, callbackQuery.id, "Now type your message");
      } else if (data === 'cancel_broadcast') {
        await deleteSession(chatId);
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

      console.log('Message from chat:', chatId, 'text:', text);

      // Check if user is admin
      if (!adminChatIds.includes(chatId)) {
        console.log('User not authorized. Chat ID:', chatId, 'Allowed:', adminChatIds);
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
          "• /donors - View top donors by donations\n" +
          "• /requests - View active blood requests\n" +
          "• /points - View top donors by points\n" +
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
          "• /donors - View top 10 donors by donations\n" +
          "• /requests - View active blood requests\n" +
          "• /points - View top 10 donors by points\n" +
          "• /help - Show this message\n\n" +
          "*Broadcast Flow:*\n" +
          "1. Use /broadcast\n" +
          "2. Select donor groups\n" +
          "3. Type your message\n" +
          "4. SMS sent automatically"
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /stats command
      if (text === '/stats') {
        const { data: profiles, error: statsError } = await supabase
          .from('profiles')
          .select('availability_status')
          .in('user_type', ['donor', 'both']);

        if (statsError) {
          console.error('Stats fetch error:', statsError);
        }

        if (profiles) {
          const available = profiles.filter(p => p.availability_status === 'available').length;
          const unavailable = profiles.filter(p => p.availability_status === 'unavailable').length;
          const reserved = profiles.filter(p => p.availability_status === 'reserved').length;
          const total = profiles.length;

          // Get blood request stats
          const { data: requests } = await supabase
            .from('blood_requests')
            .select('status');

          const activeRequests = requests?.filter(r => r.status === 'active').length || 0;
          const fulfilledRequests = requests?.filter(r => r.status === 'fulfilled').length || 0;

          // Get donation count
          const { data: donations } = await supabase
            .from('donation_history')
            .select('id');

          const totalDonations = donations?.length || 0;

          await sendTelegramMessage(botToken, chatId,
            "📊 *Platform Statistics*\n\n" +
            "*Donors:*\n" +
            `✅ Available: ${available}\n` +
            `⏳ Unavailable: ${unavailable}\n` +
            `🔒 Reserved: ${reserved}\n` +
            `👥 Total: ${total}\n\n` +
            "*Blood Requests:*\n" +
            `🔴 Active: ${activeRequests}\n` +
            `✅ Fulfilled: ${fulfilledRequests}\n\n` +
            "*Donations:*\n" +
            `💉 Total: ${totalDonations}`
          );
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /donors command - Top donors by donation count
      if (text === '/donors') {
        const { data: donations, error: donationsError } = await supabase
          .from('donation_history')
          .select('donor_id');

        if (donationsError) {
          console.error('Donations fetch error:', donationsError);
          await sendTelegramMessage(botToken, chatId, "❌ Error fetching donation data");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Count donations per donor
        const donationCounts: Record<string, number> = {};
        donations?.forEach(d => {
          donationCounts[d.donor_id] = (donationCounts[d.donor_id] || 0) + 1;
        });

        // Sort and get top 10
        const topDonorIds = Object.entries(donationCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        if (topDonorIds.length === 0) {
          await sendTelegramMessage(botToken, chatId, "📊 No donation history found yet.");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fetch donor names
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, blood_group')
          .in('id', topDonorIds.map(d => d[0]));

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        let message = "🏆 *Top 10 Donors by Donations*\n\n";
        topDonorIds.forEach(([donorId, count], index) => {
          const profile = profileMap.get(donorId);
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          message += `${medal} ${profile?.full_name || 'Unknown'} (${profile?.blood_group || '?'}) - ${count} donation${count > 1 ? 's' : ''}\n`;
        });

        await sendTelegramMessage(botToken, chatId, message);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /requests command - Active blood requests
      if (text === '/requests') {
        const { data: requests, error: requestsError } = await supabase
          .from('blood_requests')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(10);

        if (requestsError) {
          console.error('Requests fetch error:', requestsError);
          await sendTelegramMessage(botToken, chatId, "❌ Error fetching blood requests");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!requests || requests.length === 0) {
          await sendTelegramMessage(botToken, chatId, "✅ No active blood requests at the moment.");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let message = "🩸 *Active Blood Requests*\n\n";
        requests.forEach((req, index) => {
          const urgencyIcon = req.urgency === 'critical' ? '🚨' : req.urgency === 'urgent' ? '⚠️' : '📋';
          message += `${urgencyIcon} *${req.blood_group}* - ${req.patient_name}\n`;
          message += `   🏥 ${req.hospital_name}\n`;
          message += `   📱 ${req.contact_phone}\n`;
          message += `   💉 ${req.units_needed} unit(s) needed\n\n`;
        });

        await sendTelegramMessage(botToken, chatId, message);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /points command - Top donors by points
      if (text === '/points') {
        const { data: pointsData, error: pointsError } = await supabase
          .from('donor_points')
          .select('donor_id, total_points, lifetime_points')
          .order('total_points', { ascending: false })
          .limit(10);

        if (pointsError) {
          console.error('Points fetch error:', pointsError);
          await sendTelegramMessage(botToken, chatId, "❌ Error fetching points data");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!pointsData || pointsData.length === 0) {
          await sendTelegramMessage(botToken, chatId, "📊 No points data found yet.");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fetch donor names
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, blood_group')
          .in('id', pointsData.map(d => d.donor_id));

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        let message = "🏆 *Top 10 Donors by Points*\n\n";
        pointsData.forEach((donor, index) => {
          const profile = profileMap.get(donor.donor_id);
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          message += `${medal} ${profile?.full_name || 'Unknown'} (${profile?.blood_group || '?'})\n`;
          message += `   💰 ${donor.total_points} pts (Lifetime: ${donor.lifetime_points})\n\n`;
        });

        await sendTelegramMessage(botToken, chatId, message);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /broadcast command
      if (text === '/broadcast') {
        await deleteSession(chatId); // Clear any existing session
        await upsertSession(chatId, [], 'select');
        await sendGroupSelectionMessage(botToken, chatId, supabase);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle message input for broadcast
      const session = await getSession(chatId);
      console.log('Session for broadcast message:', session);
      
      if (session && session.step === 'message') {
        const broadcastMessage = text;
        const groups = session.groups || [];
        
        console.log('Processing broadcast - groups:', groups, 'message:', broadcastMessage);
        
        // Clear session
        await deleteSession(chatId);

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
          // Build recipients list (limit to 20 to avoid message too long)
          const recipientsList = result.sentNumbers || [];
          const displayList = recipientsList.slice(0, 20);
          const moreCount = recipientsList.length - 20;
          
          let recipientsText = displayList.join('\n');
          if (moreCount > 0) {
            recipientsText += `\n... and ${moreCount} more`;
          }
          
          await sendTelegramMessage(botToken, chatId,
            `✅ *Broadcast Sent Successfully!*\n\n` +
            `📱 SMS sent to *${result.sentCount}* donors:\n\n` +
            `${recipientsText}\n\n` +
            `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Indian/Maldives', dateStyle: 'medium', timeStyle: 'medium' })} (MVT)`
          );
        } else {
          // Build failed list if available
          let failedText = '';
          if (result.failedNumbers && result.failedNumbers.length > 0) {
            const displayFailed = result.failedNumbers.slice(0, 20);
            const moreCount = result.failedNumbers.length - 20;
            failedText = '\n\n*Failed recipients:*\n' + displayFailed.join('\n');
            if (moreCount > 0) {
              failedText += `\n... and ${moreCount} more`;
            }
          }
          
          await sendTelegramMessage(botToken, chatId, 
            `❌ *Broadcast Failed*\n\n${result.error}${failedText}`
          );
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
    return new Response(JSON.stringify({ ok: true, error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    const result = await response.json();
    console.log('Send message result:', result);
    return result;
  } catch (error) {
    console.error('Send message error:', error);
  }
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
  } catch (error) {
    console.error('Answer callback error:', error);
  }
}

async function sendGroupSelectionMessage(botToken: string, chatId: string, supabase: any) {
  // Get registered donor counts
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('availability_status, available_date')
    .in('user_type', ['donor', 'both']);

  if (error) {
    console.error('Error fetching profiles for stats:', error);
  }

  // Get unregistered donor count from donor_directory
  const { data: unregisteredDonors, error: dirError } = await supabase
    .from('donor_directory')
    .select('id')
    .eq('is_registered', false);

  if (dirError) {
    console.error('Error fetching donor directory for stats:', dirError);
  }

  const now = new Date().toISOString().split('T')[0]; // Today's date
  const available = profiles?.filter((p: any) => p.availability_status === 'available').length || 0;
  const waitingPeriod = profiles?.filter((p: any) => 
    p.availability_status === 'unavailable' && p.available_date && p.available_date > now
  ).length || 0;
  const unavailable = profiles?.filter((p: any) => 
    p.availability_status === 'unavailable' && (!p.available_date || p.available_date <= now)
  ).length || 0;
  const reserved = profiles?.filter((p: any) => p.availability_status === 'reserved').length || 0;
  const total = profiles?.length || 0;
  const unregistered = unregisteredDonors?.length || 0;

  const keyboard = {
    inline_keyboard: [
      [{ text: `📢 All Registered (${total})`, callback_data: 'group_all' }],
      [{ text: `✅ Available - Can donate (${available})`, callback_data: 'group_available' }],
      [{ text: `⏳ Waiting Period (${waitingPeriod})`, callback_data: 'group_waiting' }],
      [{ text: `❌ Unavailable Only (${unavailable})`, callback_data: 'group_unavailable' }],
      [{ text: `🔒 Reserved (${reserved})`, callback_data: 'group_reserved' }],
      [{ text: `📋 Unregistered Donors (${unregistered})`, callback_data: 'group_unregistered' }],
      [
        { text: '✅ Confirm', callback_data: 'confirm_groups' },
        { text: '❌ Cancel', callback_data: 'cancel_broadcast' }
      ]
    ]
  };

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: "📢 *SMS Broadcast*\n\nSelect donor groups to send SMS to:\n\n" +
        "*Registered Donors:*\n" +
        "• *Available* - Can donate now (90+ days)\n" +
        "• *Waiting Period* - Within 90-day wait\n" +
        "• *Unavailable* - Not available\n" +
        "• *Reserved* - Reserved for requests\n\n" +
        "*Directory:*\n" +
        "• *Unregistered* - Not yet registered\n\n" +
        "_Tap groups to select/deselect, then confirm_",
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  });
  
  const result = await response.json();
  console.log('Group selection message result:', result);
}

async function updateGroupSelectionMessage(botToken: string, chatId: string, messageId: number, selectedGroups: string[]) {
  const checkMark = (group: string) => selectedGroups.includes(group) || selectedGroups.includes('all') ? '☑️' : '⬜';

  const groupLabels: Record<string, string> = {
    'all': 'All Registered',
    'available': 'Available',
    'waiting': 'Waiting Period',
    'unavailable': 'Unavailable',
    'reserved': 'Reserved',
    'unregistered': 'Unregistered'
  };

  const keyboard = {
    inline_keyboard: [
      [{ text: `${checkMark('all')} All Registered`, callback_data: 'group_all' }],
      [{ text: `${checkMark('available')} Available - Can donate`, callback_data: 'group_available' }],
      [{ text: `${checkMark('waiting')} Waiting Period`, callback_data: 'group_waiting' }],
      [{ text: `${checkMark('unavailable')} Unavailable Only`, callback_data: 'group_unavailable' }],
      [{ text: `${checkMark('reserved')} Reserved`, callback_data: 'group_reserved' }],
      [{ text: `${checkMark('unregistered')} Unregistered Donors`, callback_data: 'group_unregistered' }],
      [
        { text: '✅ Confirm', callback_data: 'confirm_groups' },
        { text: '❌ Cancel', callback_data: 'cancel_broadcast' }
      ]
    ]
  };

  const selectedText = selectedGroups.length > 0 
    ? `\n\n✅ Selected: ${selectedGroups.includes('all') ? 'All Registered' : selectedGroups.map(g => groupLabels[g] || g).join(', ')}`
    : '';

  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: `📢 *SMS Broadcast*\n\nSelect donor groups to send SMS to:\n\n` +
        `*Registered Donors:*\n` +
        `• *Available* - Can donate now (90+ days)\n` +
        `• *Waiting Period* - Within 90-day wait\n` +
        `• *Unavailable* - Not available\n` +
        `• *Reserved* - Reserved for requests\n\n` +
        `*Directory:*\n` +
        `• *Unregistered* - Not yet registered${selectedText}`,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  });
  
  const result = await response.json();
  console.log('Update group selection result:', result);
}

async function sendSMSBroadcast(supabase: any, groups: string[], message: string): Promise<{ success: boolean; sentCount?: number; failedCount?: number; sentNumbers?: string[]; failedNumbers?: string[]; error?: string }> {
  try {
    console.log('Starting SMS broadcast to groups:', groups, 'message:', message);
    
    let donors: any[] = [];
    const now = new Date().toISOString().split('T')[0]; // Today's date
    
    // Check if we need registered donors (any group except only 'unregistered')
    const needsRegistered = groups.includes('all') || groups.includes('available') || 
                           groups.includes('waiting') || groups.includes('unavailable') || 
                           groups.includes('reserved');
    
    if (needsRegistered) {
      // Fetch registered donors from profiles
      const { data: allDonors, error: fetchError } = await supabase
        .from('profiles')
        .select('phone, full_name, availability_status, available_date')
        .in('user_type', ['donor', 'both']);

      if (fetchError) {
        console.error('Database error fetching donors:', fetchError);
        return { success: false, error: 'Failed to fetch donors: ' + fetchError.message };
      }

      // Filter registered donors based on selected groups
      let filteredDonors = allDonors || [];
      if (!groups.includes('all')) {
        filteredDonors = filteredDonors.filter((d: any) => {
          if (groups.includes('available') && d.availability_status === 'available') return true;
          if (groups.includes('waiting') && d.availability_status === 'unavailable' && d.available_date && d.available_date > now) return true;
          if (groups.includes('unavailable') && d.availability_status === 'unavailable' && (!d.available_date || d.available_date <= now)) return true;
          if (groups.includes('reserved') && d.availability_status === 'reserved') return true;
          return false;
        });
      }
      donors = [...donors, ...filteredDonors];
    }
    
    // Check if we need unregistered donors from directory
    if (groups.includes('unregistered')) {
      const { data: unregisteredDonors, error: dirError } = await supabase
        .from('donor_directory')
        .select('phone, full_name')
        .eq('is_registered', false);

      if (dirError) {
        console.error('Database error fetching unregistered donors:', dirError);
      } else if (unregisteredDonors) {
        donors = [...donors, ...unregisteredDonors];
      }
    }

    console.log('Found donors:', donors?.length || 0);

    if (!donors || donors.length === 0) {
      return { success: false, error: 'No donors found in selected groups' };
    }

    const textbeeApiKey = Deno.env.get('TEXTBEE_API_KEY');
    const textbeeDeviceId = Deno.env.get('TEXTBEE_DEVICE_ID');
    
    console.log('Textbee config - API Key exists:', !!textbeeApiKey, 'Device ID exists:', !!textbeeDeviceId);
    
    if (!textbeeApiKey || !textbeeDeviceId) {
      return { success: false, error: 'SMS service not configured (missing TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID)' };
    }

    // Format phone numbers - add +960 prefix if not present
    const donorPhoneMap = donors.map((d: any) => {
      const originalPhone = d.phone.toString();
      const phone = originalPhone.replace(/\D/g, ''); // Remove non-digits
      let formattedPhone: string;
      if (phone.startsWith('960')) {
        formattedPhone = '+' + phone;
      } else if (phone.startsWith('+960')) {
        formattedPhone = phone;
      } else {
        formattedPhone = '+960' + phone;
      }
      return { 
        original: originalPhone, 
        formatted: formattedPhone, 
        name: d.full_name 
      };
    });

    const phoneNumbers = donorPhoneMap.map((d: any) => d.formatted);
    console.log('Phone numbers to send SMS:', phoneNumbers);

    // Log SMS attempts
    for (const donor of donors) {
      const { error: logError } = await supabase.from('sms_logs').insert({
        recipient_phone: donor.phone,
        recipient_name: donor.full_name,
        message_body: message,
        status: 'pending',
      });
      if (logError) console.error('SMS log insert error:', logError);
    }

    // Send SMS via Textbee
    const textbeePayload = {
      recipients: phoneNumbers,
      message: message,
    };
    
    console.log('Sending to Textbee:', JSON.stringify(textbeePayload));

    const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${textbeeDeviceId}/sendSms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': textbeeApiKey,
      },
      body: JSON.stringify(textbeePayload),
    });

    const responseText = await response.text();
    console.log('Textbee response status:', response.status, 'body:', responseText);

    if (!response.ok) {
      console.error('Textbee error:', responseText);
      
      // Update logs to failed
      for (const donor of donors) {
        await supabase
          .from('sms_logs')
          .update({ 
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: responseText
          })
          .eq('recipient_phone', donor.phone)
          .eq('status', 'pending');
      }
      
      const failedNumbers = donorPhoneMap.map((d: any) => `${d.name}: ${d.original}`);
      return { 
        success: false, 
        error: 'SMS service error: ' + responseText,
        failedCount: phoneNumbers.length,
        failedNumbers: failedNumbers
      };
    }

    // Update SMS logs to sent status
    for (const donor of donors) {
      await supabase
        .from('sms_logs')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('recipient_phone', donor.phone)
        .eq('status', 'pending');
    }

    console.log(`SMS broadcast sent to ${phoneNumbers.length} donors`);

    const sentNumbers = donorPhoneMap.map((d: any) => `${d.name}: ${d.original}`);
    return { 
      success: true, 
      sentCount: phoneNumbers.length,
      sentNumbers: sentNumbers
    };
  } catch (error) {
    console.error('Error sending SMS broadcast:', error);
    return { success: false, error: 'Failed to send broadcast: ' + String(error) };
  }
}