import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DonorProfile {
  id: string;
  full_name: string;
  phone: string;
  blood_group: string;
  availability_status: string;
  available_date: string | null;
  last_wellness_check: string | null;
  unavailable_until: string | null;
}

interface NotificationMessage {
  message_key: string;
  message_title: string;
  message_template: string;
  is_enabled: boolean;
}

// Replace template variables with actual donor data
function replaceTemplateVariables(template: string, donor: DonorProfile): string {
  return template
    .replace(/{full_name}/g, donor.full_name || "Donor")
    .replace(/{blood_group}/g, donor.blood_group || "")
    .replace(/{phone}/g, donor.phone || "");
}

// Send SMS via Textbee API
async function sendSMS(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const TEXTBEE_API_KEY = Deno.env.get("TEXTBEE_API_KEY");
  const TEXTBEE_DEVICE_ID = Deno.env.get("TEXTBEE_DEVICE_ID");

  if (!TEXTBEE_API_KEY || !TEXTBEE_DEVICE_ID) {
    console.error("Missing Textbee credentials");
    return { success: false, error: "Missing Textbee credentials" };
  }

  // Format phone number for Maldives
  let formattedPhone = phone.replace(/\D/g, "");
  if (!formattedPhone.startsWith("960")) {
    formattedPhone = "960" + formattedPhone;
  }
  formattedPhone = "+" + formattedPhone;

  try {
    const response = await fetch(
      `https://api.textbee.dev/api/v1/gateway/devices/${TEXTBEE_DEVICE_ID}/sendSMS`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": TEXTBEE_API_KEY,
        },
        body: JSON.stringify({
          recipients: [formattedPhone],
          message: message,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Textbee API error:", errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    console.error("SMS send error:", error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`[Wellness Check] Running for date: ${today}`);

    // Fetch all enabled notification templates
    const { data: templates, error: templatesError } = await supabase
      .from("notification_messages")
      .select("*")
      .eq("is_enabled", true);

    if (templatesError) {
      console.error("Error fetching templates:", templatesError);
      throw templatesError;
    }

    const templateMap = new Map<string, NotificationMessage>();
    templates?.forEach((t: NotificationMessage) => templateMap.set(t.message_key, t));

    const results = {
      availabilityRestored: { sent: 0, failed: 0, skipped: 0 },
      wellnessCheck: { sent: 0, failed: 0, skipped: 0 },
    };

    // ============================================
    // PART 1: Availability Restored Notifications
    // ============================================
    const availabilityTemplate = templateMap.get("availability_restored");
    
    if (availabilityTemplate) {
      // Find donors whose available_date is today
      const { data: newlyAvailable, error: availableError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, blood_group, availability_status, available_date, last_wellness_check, unavailable_until")
        .eq("available_date", today)
        .not("phone", "is", null);

      if (availableError) {
        console.error("Error fetching newly available donors:", availableError);
      } else if (newlyAvailable && newlyAvailable.length > 0) {
        console.log(`[Availability] Found ${newlyAvailable.length} donors becoming available today`);

        for (const donor of newlyAvailable) {
          // Check if already notified today
          const { data: existingLog } = await supabase
            .from("donor_wellness_logs")
            .select("id")
            .eq("donor_id", donor.id)
            .eq("notification_type", "availability_restored")
            .gte("sent_at", today)
            .maybeSingle();

          if (existingLog) {
            console.log(`[Availability] Skipping ${donor.full_name} - already notified today`);
            results.availabilityRestored.skipped++;
            continue;
          }

          // Send SMS
          const message = replaceTemplateVariables(availabilityTemplate.message_template, donor);
          const smsResult = await sendSMS(donor.phone, message);

          // Log the notification
          await supabase.from("donor_wellness_logs").insert({
            donor_id: donor.id,
            notification_type: "availability_restored",
            sent_via: "sms",
            message_sent: message,
            status: smsResult.success ? "sent" : "failed",
            error_message: smsResult.error || null,
          });

          if (smsResult.success) {
            console.log(`[Availability] SMS sent to ${donor.full_name}`);
            results.availabilityRestored.sent++;
          } else {
            console.error(`[Availability] Failed to send SMS to ${donor.full_name}:`, smsResult.error);
            results.availabilityRestored.failed++;
          }
        }
      } else {
        console.log("[Availability] No donors becoming available today");
      }
    } else {
      console.log("[Availability] Template disabled or not found");
    }

    // ============================================
    // PART 2: Monthly Wellness Check
    // ============================================
    const wellnessFirstTemplate = templateMap.get("wellness_check_first");
    const wellnessFollowupTemplate = templateMap.get("wellness_check_followup");

    if (wellnessFirstTemplate || wellnessFollowupTemplate) {
      // Find donors who are unavailable and need a wellness check
      // - availability_status = 'unavailable'
      // - unavailable_until is NULL (indefinite) or in the past
      // - last_wellness_check was > 30 days ago OR never sent
      const { data: needsWellnessCheck, error: wellnessError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, blood_group, availability_status, available_date, last_wellness_check, unavailable_until")
        .eq("availability_status", "unavailable")
        .not("phone", "is", null);

      if (wellnessError) {
        console.error("Error fetching donors for wellness check:", wellnessError);
      } else if (needsWellnessCheck && needsWellnessCheck.length > 0) {
        console.log(`[Wellness] Found ${needsWellnessCheck.length} unavailable donors to check`);

        for (const donor of needsWellnessCheck) {
          // Skip if unavailable_until is set and in the future (temporary unavailability)
          if (donor.unavailable_until) {
            const unavailableUntil = new Date(donor.unavailable_until);
            if (unavailableUntil > new Date()) {
              console.log(`[Wellness] Skipping ${donor.full_name} - unavailable until ${donor.unavailable_until}`);
              results.wellnessCheck.skipped++;
              continue;
            }
          }

          // Check if last wellness check was within 30 days
          if (donor.last_wellness_check) {
            const lastCheck = new Date(donor.last_wellness_check);
            if (lastCheck > thirtyDaysAgo) {
              console.log(`[Wellness] Skipping ${donor.full_name} - checked on ${donor.last_wellness_check}`);
              results.wellnessCheck.skipped++;
              continue;
            }
          }

          // Determine which template to use (first or followup)
          const isFirstCheck = !donor.last_wellness_check;
          const template = isFirstCheck ? wellnessFirstTemplate : wellnessFollowupTemplate;

          if (!template) {
            console.log(`[Wellness] Template not available for ${isFirstCheck ? "first" : "followup"} check`);
            results.wellnessCheck.skipped++;
            continue;
          }

          // Send SMS
          const message = replaceTemplateVariables(template.message_template, donor);
          const smsResult = await sendSMS(donor.phone, message);

          // Log the notification
          await supabase.from("donor_wellness_logs").insert({
            donor_id: donor.id,
            notification_type: isFirstCheck ? "wellness_check_first" : "wellness_check_followup",
            sent_via: "sms",
            message_sent: message,
            status: smsResult.success ? "sent" : "failed",
            error_message: smsResult.error || null,
          });

          // Update last_wellness_check timestamp
          if (smsResult.success) {
            await supabase
              .from("profiles")
              .update({ last_wellness_check: new Date().toISOString() })
              .eq("id", donor.id);

            console.log(`[Wellness] SMS sent to ${donor.full_name} (${isFirstCheck ? "first" : "followup"})`);
            results.wellnessCheck.sent++;
          } else {
            console.error(`[Wellness] Failed to send SMS to ${donor.full_name}:`, smsResult.error);
            results.wellnessCheck.failed++;
          }
        }
      } else {
        console.log("[Wellness] No donors need wellness check");
      }
    } else {
      console.log("[Wellness] Templates disabled or not found");
    }

    // ============================================
    // Summary
    // ============================================
    const summary = {
      date: today,
      availabilityRestored: results.availabilityRestored,
      wellnessCheck: results.wellnessCheck,
      totalSent: results.availabilityRestored.sent + results.wellnessCheck.sent,
      totalFailed: results.availabilityRestored.failed + results.wellnessCheck.failed,
    };

    console.log("[Summary]", JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Wellness check error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
