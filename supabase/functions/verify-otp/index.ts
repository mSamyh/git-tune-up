import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;

// In-memory store for attempt tracking (resets on function cold start)
// For production, consider using a database table
const attemptStore = new Map<string, { attempts: number; lockedUntil: Date | null }>();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, otp, userData } = await req.json();

    if (!phone || !otp) {
      throw new Error("Phone and OTP are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Backend configuration missing");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if phone is locked out
    const attemptData = attemptStore.get(phone) || { attempts: 0, lockedUntil: null };
    const now = new Date();

    if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
      const remainingMinutes = Math.ceil((attemptData.lockedUntil.getTime() - now.getTime()) / 60000);
      console.log(`Phone ${phone} is locked out for ${remainingMinutes} more minutes`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
          locked: true,
          remainingMinutes
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        }
      );
    }

    // Reset attempts if lockout period has passed
    if (attemptData.lockedUntil && now >= attemptData.lockedUntil) {
      attemptData.attempts = 0;
      attemptData.lockedUntil = null;
    }

    // Fetch matching OTP records
    const { data: otpRecords, error: fetchError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("phone", phone)
      .eq("otp", otp)
      .eq("verified", false)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("OTP fetch error:", fetchError);
      throw new Error("Failed to verify OTP");
    }

    if (!otpRecords || otpRecords.length === 0) {
      // Increment failed attempts
      attemptData.attempts += 1;
      const remainingAttempts = MAX_ATTEMPTS - attemptData.attempts;
      
      console.log(`Failed OTP attempt for ${phone}. Attempt ${attemptData.attempts}/${MAX_ATTEMPTS}`);

      if (attemptData.attempts >= MAX_ATTEMPTS) {
        // Lock out the phone
        attemptData.lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
        attemptStore.set(phone, attemptData);
        console.log(`Phone ${phone} is now locked out until ${attemptData.lockedUntil.toISOString()}`);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Too many failed attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`,
            locked: true,
            remainingMinutes: LOCKOUT_MINUTES
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 429,
          }
        );
      }

      attemptStore.set(phone, attemptData);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid OTP code. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining.`,
          remainingAttempts
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const otpData = otpRecords[0];

    // Check expiry
    const expiresAt = new Date(otpData.expires_at);

    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ success: false, error: "OTP has expired. Please request a new code." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Mark OTP as verified
    const { error: updateError } = await supabase
      .from("otp_verifications")
      .update({ verified: true })
      .eq("id", otpData.id);

    if (updateError) {
      console.error("OTP update error:", updateError);
      throw new Error("Failed to mark OTP as verified");
    }

    // Clear attempts on successful verification
    attemptStore.delete(phone);
    console.log(`OTP verified successfully for ${phone}. Attempts reset.`);

    // Only verify OTP, don't create user yet
    // User will be created after email/password setup
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "OTP verified successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in verify-otp function:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
